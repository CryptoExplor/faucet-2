// /api/passport-score.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required.' });
  }
  
  const PASSPORT_THRESHOLD = 10;
  
  const { GITCOIN_PASSPORT_API_URL, GITCOIN_PASSPORT_API_KEY } = process.env;

  if (!GITCOIN_PASSPORT_API_URL || !GITCOIN_PASSPORT_API_KEY) {
      console.error('Missing Gitcoin Passport environment variables.');
      return res.status(500).json({ error: 'Server configuration error.' });
  }
  
  try {
    const response = await fetch(`${GITCOIN_PASSPORT_API_URL}/score/${address}`, {
      headers: {
        'X-API-Key': GITCOIN_PASSPORT_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: `Passport API Error: ${errorData.detail || 'Unknown error'}` });
    }

    const data = await response.json();
    const score = data.score || 0;

    res.status(200).json({
      address: address,
      score: score,
      // CORRECTED: Use `passing_score` to match frontend expectations
      passing_score: score >= PASSPORT_THRESHOLD, 
    });

  } catch (error) {
    console.error('Error fetching Gitcoin Passport score:', error);
    res.status(500).json({ error: 'Failed to retrieve Gitcoin Passport score.' });
  }
};
