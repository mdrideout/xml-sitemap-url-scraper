const { sitemapUrlScraper } = require('./index.js');

let sitemapArray = [
    "https://www.theguardian.com/sitemaps/news.xml",    // XML sitemap with <urlset> parent
    "https://www.whitehouse.gov/sitemap_index.xml",     // XML sitemap with <sitemapindex> parent, and no compressed sitemaps
    "https://www.delish.com/sitemap_index.xml",         // XML sitemap with <sitemapindex> parent, compressed child sitemaps
];

let urls = sitemapUrlScraper(sitemapArray, 5);

urls.then(result => {
    console.log("Returned URLs: ", result);
})
.catch(err => {
    console.log(err);
})