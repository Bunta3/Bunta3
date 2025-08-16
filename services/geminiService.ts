import { GoogleGenAI, Type } from "@google/genai";
import { type Settings } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("APIキーが設定されていません。環境変数 'API_KEY' を設定してください。");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

export const extractTextFromImage = async (file: File): Promise<string> => {
  const base64Image = await fileToBase64(file);
  const imagePart = {
    inlineData: {
      mimeType: file.type,
      data: base64Image,
    },
  };
  const textPart = {
    text: `この画像はスマートフォンのスクリーンショットです。画像に含まれるテキストの中から、以下の条件に従ってユーザーからの問い合わせメッセージ本文のみを抽出してください。

- **抽出対象:** メッセージ本文の白い文字のみを抽出してください。
- **抽出除外対象:**
    - 灰色の文字はすべて無視してください。
    - 画像上部にある「取引メッセージ」や「未返信」といったヘッダー情報は抽出しないでください。
    - 背景やUI要素（アイコン、ボタンなど）は無視してください。

抽出した本文テキストのみを、改行も含めて正確に書き出してください。もし抽出対象のテキストが存在しない場合は、その旨を伝えてください。`,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  });
  
  return response.text;
};

export const generateResponseIdeas = async (
    primaryText: string,
    settings: Settings,
    contextText?: string // 元の問い合わせ内容
): Promise<string[]> => {
    if (!primaryText || primaryText.trim() === "") {
        return [];
    }

    const personaMap = {
        polite: "です・ます調の、非常に丁寧な言葉遣い。",
        casual: "親しみやすく、少し砕けたカジュアルな言葉遣い。",
        formal: "ビジネス文書のような、硬くフォーマルな言葉遣い。",
        gal: "若者言葉や絵文字を多用する、いわゆる「ギャル」のような言葉遣い。",
        osaka: "ユーモアを交えた、温かみのある大阪弁。"
    };

    const personaInstruction = personaMap[settings.persona];

    const prompt = contextText
      ? `以下の「顧客からの問い合わせ内容」と、あなたが返信したい「返信の骨子」を元に、プロフェッショナルな返信案を5つ生成してください。

■顧客からの問い合わせ内容:
\`\`\`
${contextText}
\`\`\`

■返信の骨子（この内容を必ず含めてください）:
\`\`\`
${primaryText}
\`\`\`

■返信案を作成する際の制約条件：
- **文体:** ${personaInstruction}
- **文字数:** 各返信案は、おおよそ${settings.minLength}文字以上、${settings.maxLength}文字以下にしてください。
- **目的:** 「返信の骨子」で指示された内容を、自然で丁寧な文章に膨らませ、顧客の問い合わせに答える形で完成させてください。`
      : `以下の顧客からの問い合わせ内容に対して、丁寧で共感のこもった返信案を5つ生成してください。

問い合わせ内容：
「${primaryText}」

返信案を作成する際の制約条件：
- **文体:** ${personaInstruction}
- **文字数:** 各返信案は、おおよそ${settings.minLength}文字以上、${settings.maxLength}文字以下にしてください。
`;
  
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: "あなたは、経験豊富なカスタマーサポートのプロフェッショナルです。顧客に寄り添い、問題を解決するための、明確で親切な返信を作成します。指定された制約条件（文体、文字数、骨子）を厳守してください。",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    suggestions: {
                        type: Type.ARRAY,
                        description: "5つの異なるスタイルの返信案のリスト。",
                        items: {
                            type: Type.STRING
                        }
                    }
                },
                required: ['suggestions']
            },
            temperature: 0.8,
        },
    });

    try {
        const jsonResponse = JSON.parse(response.text);
        if (jsonResponse.suggestions && Array.isArray(jsonResponse.suggestions)) {
            return jsonResponse.suggestions;
        }
        return [];
    } catch (e) {
        console.error("JSONの解析に失敗しました:", e);
        const cleanedText = response.text.replace(/```json\n?/, '').replace(/```$/, '');
        try {
            const jsonResponse = JSON.parse(cleanedText);
             if (jsonResponse.suggestions && Array.isArray(jsonResponse.suggestions)) {
                return jsonResponse.suggestions;
            }
        } catch (e2) {
             console.error("再解析にも失敗しました:", e2);
        }
        return [];
    }
};