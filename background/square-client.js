const SQUARE_API = 'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add';

const ERROR_MESSAGES = {
  '000000': 'Success',
  '10004': 'Network error. Please try again',
  '10005': 'Identity verification required',
  '10007': 'Feature unavailable',
  '20002': 'Content contains restricted words',
  '20013': 'Content exceeds character limit',
  '20020': 'Cannot publish empty content',
  '20022': 'Content flagged for review',
  '20041': 'URL flagged as security risk',
  '30004': 'Account not found',
  '30008': 'Account restricted from posting',
  '220003': 'Invalid API Key',
  '220004': 'API Key expired',
  '220009': 'Daily post limit reached',
  '220010': 'Content type not supported',
  '220011': 'Content body cannot be empty',
  '2000001': 'Account permanently restricted',
  '2000002': 'Device permanently restricted'
};

export async function postToSquare(apiKey, content) {
  if (!apiKey) return { success: false, error: 'Square API Key not configured' };
  if (!content || !content.trim()) return { success: false, error: 'Content cannot be empty' };

  try {
    const res = await fetch(SQUARE_API, {
      method: 'POST',
      headers: {
        'X-Square-OpenAPI-Key': apiKey,
        'Content-Type': 'application/json',
        'clienttype': 'binanceSkill'
      },
      body: JSON.stringify({ bodyTextOnly: content })
    });

    const data = await res.json();

    if (data.code === '000000') {
      const postId = data.data?.id;
      const postUrl = postId ? `https://www.binance.com/square/post/${postId}` : null;
      return { success: true, postUrl, postId };
    }

    return {
      success: false,
      error: ERROR_MESSAGES[data.code] || `Unknown error (code: ${data.code})`,
      code: data.code
    };
  } catch (err) {
    return { success: false, error: 'Network error: ' + err.message };
  }
}

export async function getSquareApiKey() {
  const result = await chrome.storage.local.get('squareApiKey');
  return result.squareApiKey || null;
}

export async function saveSquareApiKey(key) {
  await chrome.storage.local.set({ squareApiKey: key });
}

export async function addPostHistory(entry) {
  const result = await chrome.storage.local.get('postHistory');
  const history = result.postHistory || [];
  history.unshift({ ...entry, ts: Date.now() });
  if (history.length > 50) history.length = 50;
  await chrome.storage.local.set({ postHistory: history });
}

export async function getPostHistory() {
  const result = await chrome.storage.local.get('postHistory');
  return result.postHistory || [];
}
