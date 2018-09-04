const zlib = require('zlib');
const parseString = require('xml2js').parseString;
const axios = require('axios');


let sitemapArray = [
    "https://www.delish.com/sitemap_index.xml/", // sitemapindex provides compressed sitemaps
    "https://www.allrecipes.com/gsindex.xml", // sitemapindex provides compressed sitemaps 
    "https://www.thepaleomom.com/sitemap_index.xml", // sitemapindex provides non-compressed sitemaps
    "https://www.strictchef.com/sitemap.xml", // urlset
    "https://www.ibeccreative.com/sitemap" // urlset
];



let allUrls = [];

// First, get parent level XML sitemaps as an array of JSON objects
let parentSiteMaps = getSitemapsAsJson(sitemapArray);
parentSiteMaps
.then((result) => {
    console.log("Parent Site Maps: ", result);

    // Add any parsed urlset(s) to the allUrls array
    handleUrlsets(result.filter(item => {
        if(typeof item["urlset"] !== "undefined") {
            return true;
        }
    }));

    
    // Handle sitemapindex objects (under which more sitemaps are nested, potentially compressed)
    handleSitemapindex(result.filter(item => {
        if (typeof item["sitemapindex"] !== "undefined") {
            return true;
        }
    }));


})



/**
 * Handle urlsets
 * @param {array} urlsetArray is an array of urlset objects parsed from xml
 */
function handleUrlsets(urlsetArray) {
    // Push urls to allUrls array
    urlsetArray.forEach(urlSet => {
        urlSet["urlset"]["url"].forEach(url => {
            allUrls.push(url["loc"][0])
        })
    })
    // console.log("URLSET URLs: ", allUrls);
}



/**
 * Handle sitemapindex Objects
 * Gets the URL's of all sitemaps listed in the sitemapindex, and proceeds to get them as JSON using getSitemapsAsJson
 * @param {array} sitemapindexArray is an array of sitemapindex objects parsed from xml
 */
function handleSitemapindex(sitemapindexArray) {
    // console.log("Site Map Indexes: ", sitemapindexArray);
    console.log("Site Map Index Example: ", sitemapindexArray[0]["sitemapindex"]["sitemap"]);
}


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

