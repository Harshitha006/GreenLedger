const axios = require('axios');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Call OCR service
const callOCRService = async (imageUrl) => {
  try {
    // Download image and convert to form data
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const formData = new FormData();
    formData.append('file', buffer, { filename: 'bill.jpg' });

    const ocrResponse = await axios.post(`${AI_SERVICE_URL}/api/ocr/electricity-bill`, formData, {
      headers: formData.getHeaders(),
    });

    return ocrResponse.data;
  } catch (error) {
    console.error('OCR service error:', error);
    return { success: false, error: error.message };
  }
};

// Call duplicate check
const callDuplicateCheck = async (imageUrl) => {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const formData = new FormData();
    formData.append('file', buffer, { filename: 'document.jpg' });

    const duplicateResponse = await axios.post(`${AI_SERVICE_URL}/api/verify/duplicate`, formData, {
      headers: formData.getHeaders(),
    });

    return duplicateResponse.data;
  } catch (error) {
    console.error('Duplicate check error:', error);
    return { is_duplicate: false, confidence: 0 };
  }
};

// Call anomaly detection
const callAnomalyDetection = async (data) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/verify/anomaly`, data);
    return response.data;
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return { is_anomaly: false, confidence: 0.5 };
  }
};

// Call fraud analysis
const callFraudAnalysis = async (data) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/fraud/analyze`, data);
    return response.data;
  } catch (error) {
    console.error('Fraud analysis error:', error);
    return { fraud_probability: 0, risk_level: 'LOW' };
  }
};

// Call tamper detection
const callTamperDetection = async (imageUrl) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/verify/tamper`, {
      image_url: imageUrl
    });
    return response.data;
  } catch (error) {
    console.error('Tamper detection error:', error);
    return { tamper_score: 0, risk_level: 'UNKNOWN' };
  }
};

// Call source validation
const callSourceValidation = async (data) => {
  try {
    let endpoint = '/api/validate/';

    if (data.type === 'qr') {
      endpoint += 'qr';
    } else {
      endpoint += 'api';
    }

    const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, data);
    return response.data;
  } catch (error) {
    console.error('Source validation error:', error);
    return { verified: false, confidence: 0 };
  }
};

const getPHash = async (fileBuffer) => {
  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, { filename: 'temp.jpg' });

    const response = await axios.post(`${AI_SERVICE_URL}/api/verify/duplicate`, formData, {
      headers: formData.getHeaders(),
    });

    return response.data.hashes?.phash;
  } catch (error) {
    console.error('getPHash error:', error);
    return null;
  }
};

module.exports = {
  callOCRService,
  callDuplicateCheck,
  callAnomalyDetection,
  callFraudAnalysis,
  callTamperDetection,
  callSourceValidation,
  getPHash,
};
