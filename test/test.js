const expect = require('chai').expect;
const { sitemapUrlScraper } = require('../index.js');

describe('sitemapUrlScraper(array)', () => {
  it('Should return a promise that resolves with an array of strings.', () => {
    
    // SAMPLE INPUT
    let sitemapArray = [
        "https://www.google.com/search/about/sitemap.xml",
        "https://www.google.com/docs/sitemaps.xml"
    ];

    // 2. ACT
    return sitemapUrlScraper(sitemapArray)
    .then((response) => {

        // 3. Expect
        expect(response).to.be.an("array");
        expect(response[0]).to.be.a("string");
    })
    .catch((error) => {
        // 3. Expect
        console.log("Error conducting test:", error);
    });

  });
});