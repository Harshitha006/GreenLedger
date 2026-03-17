const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

// Generate refresh token (longer expiry)
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET + 'refresh', {
        expiresIn: '30d',
    });
};

// Verify refresh token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET + 'refresh');
    } catch (error) {
        return null;
    }
};

module.exports = generateToken;
module.exports.generateRefreshToken = generateRefreshToken;
module.exports.verifyRefreshToken = verifyRefreshToken;
