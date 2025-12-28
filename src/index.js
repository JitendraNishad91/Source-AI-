import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // This will contain the Tailwind imports
// Firebase is initialized in src/firebase.js

// Temporary fix for the global variables not defined in local environment
// NOTE: In the Canvas environment, these are provided automatically.
// For local testing, you must provide real Firebase Config here.

window.__app_id = 'local-souce-chat';
// If you want to use the anonymous sign-in, you can keep this null
window.__initial_auth_token = null; 

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<App />);