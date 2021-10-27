const zlib = require('zlib');
const parseString = require('xml2js').parseString;
const axios = require('axios');
const util = require('util')
const pLimit = require('p-limit');

/**
 * XML Sitemap URL Scraper
 * @param {array} sitemapArray is an array of xml sitemap urls, ex: "https://www.example.com/sitemap.xml"
 * @param {number} compressedConcurrent is the number of compressed XML sitemaps to process at once (lower numbers save on CPU and Memory resources.)
 * @returns {array} of urls from all sitemaps provided
 */
const sitemapUrlScraper = (sitemapArray, compressedConcurrent = 1, headers = {}) => {
    return new Promise((resolve, reject) => {
        // Array to hold all URLs parsed out of all sitemaps
        let allUrls = [];

        // Array to hold sitemaps we're about to process
        let childSitemaps = [];

        // First, get parent level XML sitemaps as an array of JSON objects
        let parentSiteMaps = getSitemapsAsJson(sitemapArray, headers);
        parentSiteMaps
        .then((result) => {
            // Add any parsed urlset(s) to the allUrls array
            handleUrlsets(result.filter(item => {
                if(typeof item["urlset"] !== "undefined") {
                    return true;
                }
            }));

            // Get all child sitemap urls
            childSitemaps = getSitemapUrlsFromIndexes(result.filter(item => {
                if (typeof item["sitemapindex"] !== "undefined") {
                    return true;
                }
            }));

            // Parse child sitemaps that are NOT compressed, as JSON
            return getSitemapsAsJson(childSitemaps.filter(currentSitemap => {
                if (/\.gz$/i.test(currentSitemap)) {
                    return false;
                } else {
                    return true;
                }
            }, headers))

        })
        .then((result) => {
            // Add any parsed urlset(s) to the allUrls array
            handleUrlsets(result.filter(item => {
                if(typeof item["urlset"] !== "undefined") {
                    return true;
                }
            }));
            // console.log("Completed parsing non-compressed child site maps: ", util.inspect(allUrls, { maxArrayLength: null }))

            // Parse child sitemaps that ARE compressed, as JSON
            return handleCompressedXml(childSitemaps.filter(currentSitemap => {
                if (/\.gz$/i.test(currentSitemap)) {
                    return true;
                }
            }))
        })
        .then((result) => {
            // console.log("Completed getting all urlset(s) from the compressed XML sitemaps.");

            // Add any parsed urlset(s) to the allUrls array
            handleUrlsets(result.filter(item => {
                if(typeof item["urlset"] !== "undefined") {
                    return true;
                }
            }));

            // console.log("Completed parsing all sitemaps.\nAll URLS: ", util.inspect(allUrls, { maxArrayLength: 100 }))
            // console.log("Total Urls: ", allUrls.length);

            // Final return for function
            return resolve(allUrls);
        })
        .catch(err => {
            console.log("Error: ", err);
            reject(err);
        })



        /**
         * Handle urlsets
         * @param {array} urlsetArray is an array of urlset objects parsed from xml
         * @returns {*} nothing, just pushes urls into the allUrls array
         */
        function handleUrlsets(urlsetArray) {
            // Push urls to allUrls array
          urlsetArray.forEach(urlSet => {
              if(urlSet != undefined && urlSet["urlset"]["url"] != undefined) {
                  urlSet["urlset"]["url"].forEach(url => {
                      allUrls.push(url["loc"][0])
                  })
              }
            })
            // console.log("URLSET URLs: ", allUrls);
        }



        /**
         * Get Sitemap Urls From Indexes
         * Gets the URL's of all sitemaps listed in the all of the provided sitemapindex(s)
         * @param {array} sitemapindexArray is an array of sitemapindex objects parsed from xml
         * @returns {array} of child sitemaps
         */
        function getSitemapUrlsFromIndexes(sitemapindexArray) {
            // Create an array of all sitemap urls
            let allChildSitemaps = [];

            // For each sitemapindex
            sitemapindexArray.forEach(sitemapindex => {

                // for each sitemap object
                sitemapindex["sitemapindex"]["sitemap"].forEach(sitemapObject => {

                    // Add each sitemap url to our allChildSitemaps object (trim any trailing "/" to make consistent)
                    allChildSitemaps.push(sitemapObject["loc"][0].replace(/\/$/, ""));
                })
            })

            return allChildSitemaps;
        }


        /**
         * Get Sitemaps As JSON
         * Inputs an array of XML sitemap URLS
         * Outputs an array of JSON objects, converted from the XML
         * @param {array} sitemapArray is an array of URL's to xml sitemaps
         * @returns {array} a promise resolving with array of parsed xml sitemaps as JSON
         */
        function getSitemapsAsJson(sitemapArray, headers) {
          const promiseLimit = pLimit(compressedConcurrent);
            return new Promise ((resolve, reject) => {
                // Create an array of promises for each sitemap request we send
                const promises = sitemapArray.reduce((accumulator, currentSitemap) => {
                  accumulator.push(promiseLimit(() => {
                      return new Promise((resolve, reject) => {
                        // Else - if sitemap is a real URL
                        axios.get(currentSitemap, { headers })
                        .then((response) => {
                          // Parse XML into JSON
                            console.log(response.data.toString());
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
                      })
                    }));
                    return accumulator;
                }, []);

                // When all promises are resolved (all parent sitemaps retrieved)
                Promise.all(promises)
                .then(result => {
                    // console.log("Done getting batch of " + sitemapArray.length + " XML sitemaps.");
                    resolve(result);
                })
                .catch(err => {
                    console.log("XML sitemap batch error: ", err);
                    reject(err);
                });
            });
        }


        /**
         * Handle Compressed XML
         * Upzips and parses as json XML sitemaps. This is done with limited concurrency to avoid memory and CPU resource issues.
         * @param {array} compressedSitemapArray is an array of compressed XML sitemap URLS
         * @returns {*} promise resolving with an array of sitemaps parsed as JSON
         */
        function handleCompressedXml(compressedSitemapArray) {
            return new Promise((resolve, reject) => {
                // Array to store parsed XML JSON
                let parsedXmlArray = [];



                // Define our promise limiter with desired concurrency (taken from main function params)
                const promiseLimit = pLimit(compressedConcurrent);

                // Create an array of our promise returning functions
                let promises = compressedSitemapArray.map(sitemapUrl => {
                    return promiseLimit(() => processCompressedXmlFile(sitemapUrl));
                });

                (async () => {
                    // Only one promise is run at once
                    const result = await Promise.all(promises);
                    // console.log(result);
                    return resolve(result);
                })();
            });
        }


        // Retrieve a stream of the zip file, pipe it to gunzip, then parse the XML file as json - push the JSON to the parsedXmlArray - then resolve the promise to move to the next item
        function processCompressedXmlFile(sitemapUrl) {
            return new Promise((resolve, reject) => {
                console.log("Processing Compressed XML Sitemap: ", sitemapUrl);

                // Configure axios to receive a response type of stream
                axios({
                    method:'get',
                    url: sitemapUrl,
                    responseType:'stream'
                })
                .then((response) => {
                    // Buffer to hold file download stream chunks
                    let buffer = [];

                    // Instantiate Gunzip
                    let gunzip = zlib.createGunzip();

                    // Pipe response stream data to gunzip instance
                    response.data.pipe(gunzip);

                    // Handle Data / End / Error events
                    gunzip
                    .on('data', function(data) {
                        // decompression chunk ready, add it to the buffer
                        buffer.push(data.toString())
                    })
                    .on("end", function() {
                        // response and decompression complete, join the buffer
                        let fullResponse = buffer.join("");

                        // Parse the xml string into JSON
                        parseString(fullResponse, (err, result) => {
                            if(err) {
                                console.log("Compressed sitemap error: ", err);
                                reject(err);
                            } else {
                                // Resolve with the JSON parsed
                                resolve(result);                                
                            }
                        });

                    })
                    .on("error", function(e) {
                        reject(console.log("Gunzip Error: ", e));
                    })
                })
                .catch(err => {
                    reject("Axios gzip stream get error. ", err);
                });
            });
        }
    });
}



module.exports = {
    sitemapUrlScraper
}
