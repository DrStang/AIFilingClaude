import { DocumentType, DocumentMetadata } from './database.types';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// Helper to check if API key is valid (not placeholder or empty)
const isValidApiKey = (key: string | undefined): boolean => {
  return !!key && key.length > 20 && !key.includes('your_') && key !== 'undefined';
};

export interface OCRResult {
  text: string
  confidence: number
}

export interface DocumentAnalysis {
  documentType: DocumentType
  suggestedName: string
  metadata: DocumentMetadata
  confidence: number
}

/**
 * Performs OCR on an image using AI vision capabilities
 */
export async function performOCR(imageBase64: string): Promise<OCRResult> {
  try {
    if (isValidApiKey(ANTHROPIC_API_KEY)) {
      return await performOCRWithClaude(imageBase64);
    } else if (isValidApiKey(OPENAI_API_KEY)) {
      return await performOCRWithOpenAI(imageBase64);
    } else {
      throw new Error('No AI API key configured. Please set EXPO_PUBLIC_ANTHROPIC_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
    }
  } catch (error) {
    console.error('OCR error:', error);
    throw error;
  }
}

async function performOCRWithClaude(imageBase64: string): Promise<OCRResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Please extract ALL text from this document image. Return ONLY the extracted text, preserving the layout and structure as much as possible. Do not add any commentary or explanation.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  return {
    text,
    confidence: 0.95, // Claude typically has high confidence
  };
}

async function performOCRWithOpenAI(imageBase64: string): Promise<OCRResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Please extract ALL text from this document image. Return ONLY the extracted text, preserving the layout and structure as much as possible. Do not add any commentary or explanation.',
            },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  return {
    text,
    confidence: 0.95,
  };
}

/**
 * Analyzes document text and image to determine type, extract metadata, and suggest a name
 */
export async function analyzeDocument(
  imageBase64: string,
  ocrText: string
): Promise<DocumentAnalysis> {
  try {
    if (isValidApiKey(ANTHROPIC_API_KEY)) {
      return await analyzeWithClaude(imageBase64, ocrText);
    } else if (isValidApiKey(OPENAI_API_KEY)) {
      return await analyzeWithOpenAI(imageBase64, ocrText);
    } else {
      throw new Error('No AI API key configured. Please set EXPO_PUBLIC_ANTHROPIC_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
    }
  } catch (error) {
    console.error('Document analysis error:', error);
    throw error;
  }
}

async function analyzeWithClaude(
  imageBase64: string,
  ocrText: string
): Promise<DocumentAnalysis> {
  const prompt = `You are a document analysis expert. Analyze this document and provide a structured JSON response.

OCR Text:
${ocrText}

Please analyze this document and return a JSON object with the following structure:
{
  "documentType": "receipt" | "warranty" | "medical" | "tax" | "contract" | "car_service" | "insurance" | "misc",
  "suggestedName": "A clear, descriptive filename following this format: 'YYYY-MM-DD [Vendor/Entity] [Type] - [Key Detail]'",
  "metadata": {
    // Extract relevant fields based on document type:
    // Common: date, amount, vendor, category, tags
    // Receipt: items (array), amount, vendor
    // Warranty: product_name, serial_number, purchase_date, expiration_date
    // Medical: provider, patient_name, diagnosis
    // Tax: tax_year, form_type
    // Contract: contract_party, start_date, end_date
    // Car service: vehicle, mileage, service_type, next_service_date
    // Insurance: policy_number, coverage_type, premium, renewal_date
  },
  "confidence": 0.0-1.0
}

Examples of good suggestedName:
- "2024-10-12 Costco Receipt - $87.21"
- "2025-01-15 Honda Accord Brake Service - 68k miles"
- "2024-09-01 iPhone 15 Warranty - Expires 2026-09-01"
- "2024-03-15 Blue Cross Insurance - Policy Renewal"

Return ONLY the JSON object, no additional text.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  const jsonText = data.content[0].text;

  // Extract JSON from markdown code blocks if present
  const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, jsonText];
  const cleanedJson = jsonMatch[1].trim();

  const analysis = JSON.parse(cleanedJson);
  return analysis;
}

async function analyzeWithOpenAI(
  imageBase64: string,
  ocrText: string
): Promise<DocumentAnalysis> {
  const prompt = `You are a document analysis expert. Analyze this document and provide a structured JSON response.

OCR Text:
${ocrText}

Please analyze this document and return a JSON object with the following structure:
{
  "documentType": "receipt" | "warranty" | "medical" | "tax" | "contract" | "car_service" | "insurance" | "misc",
  "suggestedName": "A clear, descriptive filename following this format: 'YYYY-MM-DD [Vendor/Entity] [Type] - [Key Detail]'",
  "metadata": {
    // Extract relevant fields based on document type
  },
  "confidence": 0.0-1.0
}

Return ONLY the JSON object, no additional text.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const analysis = JSON.parse(data.choices[0].message.content);
  return analysis;
}
