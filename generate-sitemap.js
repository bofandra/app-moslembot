const fs = require('fs');
const { SitemapStream, streamToPromise } = require('sitemap');

(async () => {
  const sitemap = new SitemapStream({ hostname: 'http://moslembot.seven-muslims.com' });

  const pages = [
    '/',          // Home
    '/chat',      // Chat page
    '/about',     // About page
    // Add more routes as needed
  ];

  pages.forEach(path => sitemap.write({ url: path, changefreq: 'weekly', priority: 0.7 }));

  sitemap.end();

  const sitemapOutput = await streamToPromise(sitemap).then(sm => sm.toString());
  fs.writeFileSync('./public/sitemap.xml', sitemapOutput);
})();
