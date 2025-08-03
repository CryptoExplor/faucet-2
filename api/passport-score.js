// A simple Node.js serverless function to check a user's Gitcoin Passport score.
// This function should be deployed as an API endpoint, e.g., `/api/passport-score`.
// It requires `GITCOIN_PASSPORT_API_URL` and `GITCOIN_PASSPORT_API_KEY`
// to be set as environment variables.

module.exports = async (req, res) => {
  // Ensure the request method is GET, for security and idempotence
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get the wallet address from the query parameters
  const { address } = req.query;

  // Validate the address
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required.' });
  }
  
  // Define the minimum score threshold. This could also be an environment variable.
  const PASSPORT_THRESHOLD = 10;
  
  // Retrieve environment variables for API keys and URLs
  const GITCOIN_PASSPORT_API_URL = process.env.GITCOIN_PASSPORT_API_URL;
  const GITCOIN_PASSPORT_API_KEY = process.env.GITCOIN_PASSPORT_API_KEY;

  if (!GITCOIN_PASSPORT_API_URL || !GITCOIN_PASSPORT_API_KEY) {
      console.error('Missing Gitcoin Passport environment variables.');
      return res.status(500).json({ error: 'Server configuration error.' });
  }
  
  try {
    // Make the API call to the Gitcoin Passport service
    const response = await fetch(`${GITCOIN_PASSPORT_API_URL}/score/${address}`, {
      headers: {
        'X-API-Key': GITCOIN_PASSPORT_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle non-200 responses from the Passport API
      const errorData = await response.json();
      console.error('Gitcoin Passport API error:', errorData);
      return res.status(response.status).json({ error: `Passport API Error: ${errorData.message}` });
    }

    const data = await response.json();
    const score = data.score || 0; // Default to 0 if score is missing

    // Return the formatted passport data
    res.status(200).json({
      address: address,
      score: score,
      passing_score: score >= PASSPORT_THRESHOLD,
    });

  } catch (error) {
    console.error('Error fetching Gitcoin Passport score:', error);
    res.status(500).json({ error: 'Failed to retrieve Gitcoin Passport score.' });
  }
};
