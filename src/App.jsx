import React, { useEffect, useState } from 'react';
import ParsedIslamicPage from './ParsedIslamicPage';
import { useSearchParams } from 'react-router-dom';

function App() {
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const rawTextName = searchParams.get('raw_text');

  useEffect(() => {
    if (!rawTextName) return;

    const url = `https://api.seven-muslims.com/texts/${rawTextName}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Text not found');
        return res.text();
      })
      .then(setPartialText)
      .catch((err) => {
        console.error(err);
        setError('Unable to load the text from the server.');
      });
  }, [rawTextName]);

  const fetchRawTextFromQuery = async () => {
    if (query.length < 3) {
      setError('Query must be at least 3 characters.');
      return;
    }

    setError(null);
    setLoading(true);
    setPartialText('');

    const getUrl = 'https://moslembot-v5.hf.space/call/chat';
    const huggingFaceToken = process.env.REACT_APP_HUGGINGFACE_TOKEN;

    const payload = {
      data: [query, [], 128, 0.7, 0.95]
    };

    try {
      const chatResponse = await fetch(getUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${huggingFaceToken}`
        },
        body: JSON.stringify(payload)
      });

      const chatJson = await chatResponse.json();
      const eventId = chatJson.event_id;

      const predictUrl = `https://moslembot-v5.hf.space/call/predict/${eventId}`;
      const eventResponse = await fetch(predictUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${huggingFaceToken}`
        }
      });

      const reader = eventResponse.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value, { stream: true });

        if (chunk.includes('data')) {
          chunk = chunk
            .replace(/event: (heartbeat|complete|error|generating)/g, '')
            .replace(/data: /g, '')
            .replace(/, \[NaN\]/g, '')
            .replace(/\[NaN\], /g, '')
            .replace(/\[NaN\]/g, '')
            .replace(/, null/g, '')
            .replace(/null/g, '');

          const parts = chunk.split('["');
          if (parts.length > 1) {
            let content = parts[parts.length - 1].split('"]')[0];
            content = content.replace(/\\\[/g, '(').replace(/\\\]/g, ')');

            try {
              const decoded = JSON.parse(`["${content}"]`);
              const fullText = decoded[0];
              setPartialText(fullText);
            } catch (e) {
              console.error('JSON parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      {partialText ? (
        <div className="w-full max-w-3xl bg-white shadow-2xl rounded-3xl p-8 border border-gray-200">
          <ParsedIslamicPage rawText={partialText} />
        </div>
      ) : (
        <div className="text-center w-full max-w-xl bg-white rounded-3xl shadow-2xl p-10 border border-gray-200">
          <h1 className="text-5xl font-bold mb-10 text-indigo-700">Ask an Islamic Question</h1>
          <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded-full px-6 py-4 mb-6 shadow-inner">
            <input
              type="text"
              className="flex-1 text-lg text-gray-800 placeholder-gray-500 outline-none bg-transparent"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your Islamic query here..."
            />
          </div>
          <button
            onClick={fetchRawTextFromQuery}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-lg font-semibold px-8 py-3 rounded-full shadow-lg hover:from-indigo-600 hover:to-blue-600 transition-all duration-300"
          >
            {loading ? 'Fetching...' : 'Submit'}
          </button>
          {error && <p className="text-red-600 mt-6 text-sm font-medium">{error}</p>}
          {loading && <p className="text-gray-500 mt-4 italic">Streaming response...</p>}
        </div>
      )}
    </div>
  );
}

export default App;
