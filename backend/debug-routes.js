const express = require('express');
const path = require('path');
const fs = require('fs');

const routeFiles = [
    './routes/auth',
    './routes/actions',
    './routes/credits',
    './routes/verification',
    './routes/dashboard',
    './routes/marketplace',
    './routes/admin',
    './routes/institution'
];

routeFiles.forEach(file => {
    try {
        console.log(`Checking ${file}...`);
        const router = require(file);
        router.stack.forEach(layer => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
                const path = layer.route.path;
                layer.route.stack.forEach((s, i) => {
                    if (!s.handle) {
                        console.error(`ERROR: Undefined handler in ${file} at ${methods} ${path} (stack index ${i})`);
                    }
                });
            }
        });
    } catch (e) {
        console.error(`FAILED to load ${file}: ${e.message}`);
        console.error(e.stack);
    }
});
