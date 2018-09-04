const zlib = require('zlib');
const parseString = require('xml2js').parseString;
const axios = require('axios');


let sitemapArray = [
    "https://www.delish.com/sitemap_index.xml/",
    "https://www.allrecipes.com/gsindex.xml",
    "https://www.thepaleomom.com/sitemap_index.xml",
    "https://www.strictchef.com/sitemap.xml"
];

// Sitemap Array
// let sitemapArray = [
//     "https://www.delish.com/sitemap_index.xml/",
// ];

// Get parent level XML sitemaps as an array of JSON objects
let parentSiteMaps = getSitemapsAsJson(sitemapArray);
parentSiteMaps
.then((result) => {
    console.log("Parent Site Maps: ", result);
})






/**
 * Get Sitemaps As JSON
 * Inputs an array of XML sitemap URLS
 * Outputs an array of JSON objects, converted from the XML
 * @param {*} sitemapArray is an array of URL's to xml sitemaps
 */
function getSitemapsAsJson(sitemapArray) {
    return new Promise ((resolve, reject) => {
        // Create an array of promises for each sitemap request we send
        const promises = sitemapArray.reduce((accumulator, currentSitemap) => {
            accumulator.push(new Promise((resolve, reject) => {

                // If sitemap is a normal URL
                axios.get(currentSitemap)
                .then((response) => {
                    // Parse XML into JSON
                    parseString(response.data.toString(), (err, result) => {
                        if(err) {
                            console.log("Sitemap error: ", err);
                            reject(err);
                        } else {
                            // console.log("RESULT: ", result);
                            resolve(result);
                        }
                    });
                })
                .catch(err => {
                    reject(err);
                });


                // If sitemap is a compressed file


            }));
            return accumulator;
        }, []);

        // When all promises are resolved (all parent sitemaps retrieved)
        Promise.all(promises)
        .then(result => {
            console.log("Done getting batch of " + sitemapArray.length + " XML sitemaps.");
            resolve(result);
        })
        .catch(err => {
            console.log("XML sitemap batch error: ", err);
            reject(err);
        });
    });
}

