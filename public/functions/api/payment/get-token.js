import { getAirwallexAccessToken, errorResponse, jsonResponse } from './airwallex.js';

export async function onRequestPost(context) {
  try {
    const token = await getAirwallexAccessToken(context.env);
    return jsonResponse({ code: 200, token });
  } catch (e) {
    return errorResponse(e, 'Failed to obtain Airwallex token');
  }
}
