// /api/launch.js
// This API route handles the `post_redirect` from our Frame.
// It responds with a 302 redirect to the Mini App's main page.

export default async function handler(req, res) {
  // Ensure the request method is POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // The URL of your actual Mini App (the index.html file)
  const miniAppUrl = 'https://faucet-2.vercel.app'; // Or your specific path to index.html

  // Respond with a 302 redirect status code and the Location header
  res.setHeader('Location', miniAppUrl);
  return res.status(302).end();
}
