# xml-sitemap-url-scraper
Call the function with an array of one or more XML sitemap urls. All sitemap urls provided in this array must not be compressed. Compressed sitemaps are only supported when nested under `<sitemapindex>` tags.

_Normal:_ https://www.example.com/sitemap.xml

_Compressed:_  https://www.example.com/sitemap.xml.gz

**Returns** a promise that resolves with an array of all URLs from those sitemaps

**Install**

```
npm install --save xml-sitemap-url-scraper
```

**Requirements**

To be compatible with async in example

 - [ECMAScript 2017 (version 8)](https://www.w3schools.com/js/js_versions.asp)
 - [Node version > 8.2.1](https://node.green/)

**Demo**

```
npm start
```

**Example**

```
const { sitemapUrlScraper } = require("xml-sitemap-url-scraper");

let sitemapUrls = [
    "https://www.example.com/sitemap.xml"
]

// Define how many compressed sitemaps we want to decompress and process at once (if any are found)
let concurrency = 5;

// Function's concurrency defaults to 1 if no param is provided
let urls = sitemapUrlScraper(sitemapUrls, concurrency);

urls.then(result => {
    console.log("Returned URLs: ", result);
})
.catch(err => {
    console.log(err);
})
```

**Example Output**

```
Returned URLs:  [ 'https://www.example.com/page_one',
  'https://www.example.com/page_two' ]
```

## Nested Sitemaps in `<sitemapindex>` tags
Nested sitemaps will automatically be traversed, and their urls will be included in the final output array. This currently only supports 1 level of nesting.

**Exmaple of nested sitemaps**

```
<sitemapindex xmlns="https://www.example.com/schemas/sitemap/0.84">
    <sitemap>
        <loc>https://www.example.com/edu/sitemap.xml</loc>
    </sitemap>
    <sitemap>
        <loc>https://www.example.com/gmail/sitemap.xml</loc>
    </sitemap>
</sitemapindex>
```

## Compressed Sitemaps
Child sitemaps that are nested inside `<sitemapindex>` tags will be decompressed, and their urls will be included in the final output array. Compressed sitemaps are processed concurrently according to the parameter provided in the function call. This can help avoid memory and CPU load issues when processing a large number of compressed sitemaps. This function may take a long time to execute if there is a significant number of compressed sitemaps being scraped.

**Example of compressed sitemaps**

```
<sitemapindex xmlns="https://www.example.com/schemas/sitemap/0.84">
    <sitemap>
        <loc>https://www.example.com/edu/sitemap.xml.gz</loc>
    </sitemap>
    <sitemap>
        <loc>https://www.example.com/gmail/sitemap.xml.gz</loc>
    </sitemap>
</sitemapindex>
```