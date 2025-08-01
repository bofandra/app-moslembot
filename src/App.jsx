import React, { useEffect, useState, useRef } from 'react';
import ParsedIslamicPage from './ParsedIslamicPage';
import { useSearchParams, useLocation } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { useTranslation } from 'react-i18next';
import * as gtag from './utils/gtag';

function App() {
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [showDonatePrompt, setShowDonatePrompt] = useState(false);
  const inputRef = useRef(null);
  const recaptchaRef = useRef(null);
  const { t, i18n } = useTranslation();

  const rawTextName = searchParams.get('raw_text');
  const location = useLocation();

  const [suggestions, setSuggestions] = useState([]);

  const suggestionContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(event.target)
      ) {
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const url = `https://bofandra.pythonanywhere.com/api/suggest?q=${encodeURIComponent(query)}&lang=${i18n.language}`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-API-Key': 'a9ba6e3a-3179-44c3-a9ca-54bb641e9be3'
        }
      })
      const data = await res.json();
      setSuggestions(data.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
      setSuggestions([]);
    }
  };

  useEffect(() => {
    gtag.pageview(location.pathname + location.search);
  }, [location]);

  useEffect(() => {
    if (!i18n.language) {
      i18n.changeLanguage('en');
    }
  }, [i18n]);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    if (!rawTextName) return;

    const url = `https://bofandra.pythonanywhere.com/texts/${rawTextName}`;
    fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-API-Key': 'a9ba6e3a-3179-44c3-a9ca-54bb641e9be3'
      }
    })
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

    gtag.event({
      action: 'submit_query',
      category: 'Search',
      label: query,
    });

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
              if (fullText.length > partialText.length) {
                setPartialText(fullText);
              }
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

  const handleShare = async () => {
    if (!captchaToken) {
      alert('Please complete the CAPTCHA before sharing.');
      return;
    }

    gtag.event({
      action: 'share_text',
      category: 'Engagement',
      label: 'Shared raw text',
    });

    setShowDonatePrompt(true);
  };

  const proceedToShare = async () => {
    setShowDonatePrompt(false);

    const textToShare = partialText;
    try {
      const response = await fetch('https://bofandra.pythonanywhere.com/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'a9ba6e3a-3179-44c3-a9ca-54bb641e9be3',
        },
        body: JSON.stringify({ text: textToShare, query: query, lang: i18n.language, captcha_token: captchaToken }),
      });

      if (!response.ok) {
        throw new Error('Server responded with error');
      }

      const data = await response.json();
      const sharedUrl = `${window.location.origin}/?raw_text=${data.raw_text}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: i18n.t('share.title', 'Check this out'),
            text: query,
            url: sharedUrl,
          });
        } catch (shareError) {
          console.error('Sharing failed:', shareError);
          await navigator.clipboard.writeText(sharedUrl);
          alert(`Link copied to clipboard: ${sharedUrl}`);
        }
      } else {
        await navigator.clipboard.writeText(sharedUrl);
        alert(`Link copied to clipboard: ${sharedUrl}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to share or copy the link.');
    }
  };


  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      fetchRawTextFromQuery();
    }
  };

  const handleClose = () => {
    setPartialText('');
    setQuery('');
    setError(null);
    setCaptchaToken(null);
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      {partialText ? (
        <div className="relative w-full max-w-3xl bg-white shadow-2xl rounded-3xl p-8 border border-gray-200">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl font-bold"
          >
            &times;
          </button>
          <ParsedIslamicPage rawText={partialText} />
          
          {!rawTextName && (
            <div className="mt-6">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey="6Ld7UWorAAAAAG5ZB41Z8FEJ8YbpxFhemdEQYIY3"
                onChange={(token) => setCaptchaToken(token)}
              />
              <div className="text-right mt-4">
                <button
                  onClick={handleShare}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-6 py-2 rounded-full shadow"
                >
                  Share
                </button>
              </div>
            </div>
          )}

          {showDonatePrompt && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Would you like to donate to support?</h2>
                <p className="text-sm mb-6">Visit: <a href="https://sociabuzz.com/bofandra/tribe" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">https://sociabuzz.com/bofandra/tribe</a></p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => {
                      window.open('https://sociabuzz.com/bofandra/tribe', '_blank');
                      proceedToShare();
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full"
                  >
                    Yes, Donate
                  </button>
                  <button
                    onClick={proceedToShare}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-full"
                  >
                    No, Thanks
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center w-full max-w-xl bg-white rounded-3xl shadow-2xl p-10 border border-gray-200">
          <div className="flex justify-end mb-6 space-x-2">
            <button 
              onClick={() => i18n.changeLanguage('en')} 
              className={`px-4 py-1 border rounded text-gray-500 shadow-inner hover:bg-gray-300 ${i18n.language === 'en' ? 'bg-gray-300' : 'bg-gray-200'}`}
            >
              EN
            </button>
            <button 
              onClick={() => i18n.changeLanguage('ar')} 
              className={`px-4 py-1 border rounded text-gray-500 shadow-inner hover:bg-gray-300 ${i18n.language === 'ar' ? 'bg-gray-300' : 'bg-gray-200'}`}
            >
              AR
            </button>
            <button 
              onClick={() => i18n.changeLanguage('id')} 
              className={`px-4 py-1 border rounded text-gray-500 shadow-inner hover:bg-gray-300 ${i18n.language === 'id' ? 'bg-gray-300' : 'bg-gray-200'}`}
            >
              ID
            </button>
          </div>
          <h1 className="text-5xl font-bold mb-10 text-indigo-700">{t('askIslamicQuestion')}</h1>
          <div className="relative w-full" ref={suggestionContainerRef}>
            <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded-full px-6 py-4 mb-2 shadow-inner">
              <textarea
                ref={inputRef}
                className="flex-1 text-lg text-gray-800 placeholder-gray-500 outline-none bg-transparent resize-none"
                value={query}
                onChange={async (e) => {
                  const value = e.target.value;
                  setQuery(value);
                  if (value.length >= 4 && !loading2) {
                    setLoading2(true);
                    try {
                      await fetchSuggestions(value);
                    } finally {
                      setLoading2(false);
                    }
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('placeholder')}
              />
              {loading2 && (
                <div className="ml-2 animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-600"></div>
              )}
            </div>
            {suggestions?.length > 0 && (
              <ul className="absolute z-10 bg-white border border-gray-300 rounded-xl mt-1 w-full max-h-60 overflow-y-auto shadow-xl">
                {suggestions.map((suggestion, idx) => (
                  <li
                    key={idx}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-left"
                    onClick={() => {
                      setQuery(suggestion);
                      setSuggestions([]);
                    }}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={fetchRawTextFromQuery}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-lg font-semibold px-8 py-3 rounded-full shadow-lg hover:from-indigo-600 hover:to-blue-600 transition-all duration-300"
          >
            {loading ? t('streaming') : t('submit')}
          </button>
          {error && <p className="text-red-600 mt-6 text-sm font-medium">{error}</p>}
          {loading && (
            <div className="mt-6 flex flex-col items-center">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-300 max-w-sm overflow-hidden">
                <div className="bg-indigo-500 h-2.5 rounded-full animate-[grow_60s_linear_forwards] w-0"></div>
              </div>
              <style>
                {`
                  @keyframes grow {
                    from { width: 0; }
                    to { width: 100%; }
                  }
                `}
              </style>
              <p className="text-gray-500 mt-4 italic">{t('streaming')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;