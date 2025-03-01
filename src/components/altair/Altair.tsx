/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an Altair graph in JSON format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a JSON object.",
      },
    },
    required: ["json_graph"],
  },
};

const openYouTubeDeclaration: FunctionDeclaration = {
  name: "open_youtube",
  description: "Searches for a query on YouTube and opens the results page.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: "A search query for YouTube. Opens the YouTube search page with this query.",
      },
    },
    required: ["query"],
  },
};

const openPinterestDeclaration: FunctionDeclaration = {
  name: "open_pinterest",
  description: "Searches for a query on Pinterest and opens the results page.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: "A search query for Pinterest. Opens the Pinterest search page with this query.",
      },
    },
    required: ["query"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: `You are my helpful assistant, cut short the response and answer to the point. Use:
            - "render_altair" to generate graphs.
            - "fetch_data" to fetch external data.
            - "open_youtube" to open a YouTube video when asked.
            - "open_pinterest" to open a Pinterest search page when asked.`,
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [declaration, openYouTubeDeclaration, openPinterestDeclaration] },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log(`Received tool call:`, toolCall);

      for (const fc of toolCall.functionCalls) {
        if (fc.name === "render_altair") {
          const str = (fc.args as any).json_graph;
          setJSONString(str);
        } else if (fc.name === "fetch_data") {
          const url = (fc.args as any).url;
          try {
            const response = await fetch(url);
            const data = await response.json();
            console.log("Fetched data:", data);

            client.sendToolResponse({
              functionResponses: [
                {
                  response: { output: { data } },
                  id: fc.id,
                },
              ],
            });
          } catch (error) {
            console.error("Error fetching data:", error);
            client.sendToolResponse({
              functionResponses: [
                {
                  response: { output: { error: "Failed to fetch data." } },
                  id: fc.id,
                },
              ],
            });
          }
        } else if (fc.name === "open_youtube") {
          const query = (fc.args as any).query;

          if (query) {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            window.open(searchUrl, "_blank");
          } else {
            window.open("https://youtube.com/", "_blank"); // Open YouTube homepage if no query
          }

          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: true } },
                id: fc.id,
              },
            ],
          });
        } else if (fc.name === "open_pinterest") {
          const query = (fc.args as any).query;

          if (query) {
            const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
            window.open(searchUrl, "_blank");
          } else {
            window.open("https://pinterest.com/", "_blank"); // Open Pinterest homepage if no query
          }

          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: true } },
                id: fc.id,
              },
            ],
          });
        }
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);

  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);
