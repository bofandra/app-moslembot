import React from 'react';
import ReactMarkdown from 'react-markdown';

function extractMetadata(text) {
  const quranMatch = text.match(/#(.*?)#/);
  const hadithMatch = text.match(/<(.*?)>/);
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);

  return {
    quranRefs: quranMatch ? quranMatch[1].split('|') : [],
    hadithRefs: hadithMatch ? hadithMatch[1].split('|') : [],
    thinkText: thinkMatch ? thinkMatch[1].trim() : null,
    mainBody: text
      .replace(/#(.*?)#/, '')
      .replace(/<(.*?)>/, '')
      .replace(/<think>[\s\S]*?<\/think>/, '')
      .trim()
  };
}

const ParsedIslamicPage = ({ rawText }) => {
  const { quranRefs, hadithRefs, thinkText, mainBody } = extractMetadata(rawText);

  return (
    <div className="prose max-w-none">
      {quranRefs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Qur'an References</h3>
          <ul className="list-disc list-inside">
            {quranRefs.map((ref, i) => (
              <li key={i}>Surah {ref.split(':')[0]}: Ayah {ref.split(':')[1]}</li>
            ))}
          </ul>
        </div>
      )}

      {hadithRefs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Hadith References</h3>
          <ul className="list-disc list-inside">
            {hadithRefs.map((ref, i) => (
              <li key={i}>{ref.replace(/-/g, ' ').replace(/:/g, ' #')}</li>
            ))}
          </ul>
        </div>
      )}

      {thinkText && (
        <details className="mb-6 cursor-pointer">
          <summary className="font-semibold text-blue-700">Scholar’s Thinking (Internal Notes)</summary>
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{thinkText}</p>
        </details>
      )}

      <ReactMarkdown
        components={{
          p: ({ node, ...props }) => <p className="prose max-w-none" {...props} />,
          h1: ({ node, children, ...props }) =>
            children.length ? (
              <h1 className="prose max-w-none text-2xl font-bold" {...props}>{children}</h1>
            ) : null,

          h2: ({ node, children, ...props }) =>
            children.length ? (
              <h2 className="prose max-w-none text-xl font-semibold" {...props}>{children}</h2>
            ) : null,
          ul: ({ node, ...props }) => <ul className="prose max-w-none list-disc ml-6" {...props} />,
          ol: ({ node, ...props }) => <ol className="prose max-w-none list-decimal ml-6" {...props} />,
          li: ({ node, ...props }) => <li className="prose max-w-none" {...props} />,
          code: ({ node, ...props }) => <code className="bg-gray-100 px-1 rounded" {...props} />,
          pre: ({ node, ...props }) => <pre className="bg-gray-100 p-3 rounded overflow-auto" {...props} />,
        }}
      >
        {mainBody}
      </ReactMarkdown>

      {rawText.includes('sevenmuslims') && (
        <div className="mt-6 border-t pt-4 text-sm text-gray-600">
          <p>🔗 <a href="https://play.google.com/store/apps/details?id=com.sevenmuslims.moslem_bot" target="_blank" rel="noreferrer">Support us on the Play Store</a></p>
          <p>📋 <a href="https://forms.gle/jArgHK6uPZvnJsCDA" target="_blank" rel="noreferrer">Take our quick survey</a></p>
        </div>
      )}
    </div>
  );
};

export default ParsedIslamicPage;
