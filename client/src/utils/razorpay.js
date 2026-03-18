import { clientEnv } from '../config/env';

let razorpayScriptPromise;

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export function getRazorpayKeyId() {
  return clientEnv.razorpayKeyId || '';
}

export async function ensureRazorpayLoaded() {
  if (typeof window === 'undefined') {
    throw new Error('Razorpay can only be loaded in the browser.');
  }

  if (window.Razorpay) {
    return window.Razorpay;
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.Razorpay));
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK.')));
        return;
      }

      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        if (window.Razorpay) {
          resolve(window.Razorpay);
          return;
        }
        reject(new Error('Razorpay SDK loaded, but Razorpay is unavailable.'));
      };
      script.onerror = () => {
        reject(new Error('Failed to load Razorpay SDK.'));
      };
      document.body.appendChild(script);
    }).catch((error) => {
      razorpayScriptPromise = undefined;
      throw error;
    });
  }

  return razorpayScriptPromise;
}
