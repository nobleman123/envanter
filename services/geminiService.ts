
import { GoogleGenAI, Type } from "@google/genai";
import { CertificateAnalysisResult } from '../types';

if (!process.env.API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A brief, one-sentence summary of the certificate's purpose." },
        device_info: {
            type: Type.OBJECT,
            properties: {
                serial_number: { type: Type.STRING, description: "The identified serial number, or 'N/A'." },
                model: { type: Type.STRING, description: "The identified model, or 'N/A'." },
                equipment_type: { type: Type.STRING, description: "The type of equipment, or 'N/A'." },
            },
            required: ['serial_number', 'model', 'equipment_type'],
        },
        calibration_results: {
            type: Type.OBJECT,
            properties: {
                status: { type: Type.STRING, enum: ['PASS', 'FAIL', 'INDETERMINATE'], description: "Status based on measurement data and tolerances." },
                key_measurements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List up to 3 key measurement results." },
                reasoning: { type: Type.STRING, description: "A short explanation for the status conclusion." },
            },
            required: ['status', 'key_measurements', 'reasoning'],
        },
    },
    required: ['summary', 'device_info', 'calibration_results'],
};

export const analyzeCertificateWithGemini = async (text: string): Promise<CertificateAnalysisResult> => {
    if (!process.env.API_KEY) {
        throw new Error("API key is not configured.");
    }
    
    const prompt = `You are an expert quality assurance engineer specializing in laboratory equipment calibration. Analyze the following text extracted from a calibration certificate.
    
    Certificate Text:
    \`\`\`
    ${text}
    \`\`\`
    
    Based on the text, provide a JSON response with the specified structure. If information is not present, use 'N/A'.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as CertificateAnalysisResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to analyze certificate with AI.");
    }
};
