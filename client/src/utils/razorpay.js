import { clientEnv } from '../config/env';

let razorpayScriptPromise;

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_LOAD_TIMEOUT_MS = 12000;

export function getRazorpayKeyId() {
  return clientEnv.razorpayKeyId || '';
}

export function isRazorpayTestMode() {
  return String(getRazorpayKeyId() || '').startsWith('rzp_test_');
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

      if (existingScript && window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }

      if (existingScript) {
        existingScript.remove();
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
        script.remove();
        reject(new Error('Failed to load Razorpay SDK.'));
      };
      const timeoutId = window.setTimeout(() => {
        script.remove();
        reject(new Error('Timed out while loading Razorpay SDK.'));
      }, RAZORPAY_LOAD_TIMEOUT_MS);
      script.addEventListener('load', () => window.clearTimeout(timeoutId), { once: true });
      script.addEventListener('error', () => window.clearTimeout(timeoutId), { once: true });
      document.body.appendChild(script);
    }).catch((error) => {
      razorpayScriptPromise = undefined;
      throw error;
    });
  }

  return razorpayScriptPromise;
}
