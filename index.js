const zlib = require('zlib');
const parseString = require('xml2js').parseString;
const axios = require('axios');
const util = require('util')

/**
 * XML Sitemap URL Scraper
 * @param {array} sitemapArray is an array of xml sitemap urls, ex: "https://www.example.com/sitemap.xml"
 * @returns {array} of urls from all sitemaps provided
 */
const sitemapUrlScraper = (sitemapArray) => {
    return new Promise((resolve, reject) => {
        // Array to hold all URLs parsed out of all sitemaps
        let allUrls = [];

        // Array to hold sitemaps we're about to process
        let childSitemaps = [];

        // First, get parent level XML sitemaps as an array of JSON objects
        let parentSiteMaps = getSitemapsAsJson(sitemapArray);
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
            }))

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
            return handleCompressedXmlSync(childSitemaps.filter(currentSitemap => {
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
                urlSet["urlset"]["url"].forEach(url => {
                    allUrls.push(url["loc"][0])
                })
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
        function getSitemapsAsJson(sitemapArray) {
            return new Promise ((resolve, reject) => {
                // Create an array of promises for each sitemap request we send
                const promises = sitemapArray.reduce((accumulator, currentSitemap) => {
                    accumulator.push(new Promise((resolve, reject) => {
                        // console.log("Processing XML Sitemap: ", currentSitemap);
                        // Else - if sitemap is a real URL
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
         * Handle Compressed XML Synchronously
         * Synchronously unzips and parses as json compressed XML sitemaps. This is done synchronously to avoid memory or resource issues
         * that may come if trying to unzip and read thousands of these at once.
         * @param {array} compressedSitemapArray is an array of compressed XML sitemap URLS
         * @returns {*} promise resolving with an array of sitemaps parsed as JSON
         */
        function handleCompressedXmlSync(compressedSitemapArray) {
            return new Promise((resolve, reject) => {
                // Array to store parsed XML JSON
                let parsedXmlArray = [];

                // Use reduce to synchronously process each zipped XML file
                let promises = compressedSitemapArray.reduce((promise, sitemapUrl) => {
                    return promise.then(() => {
                        return processCompressedXmlFile(sitemapUrl);
                    });
                }, Promise.resolve());
                
                // Retrieve a stream of the zip file, pipe it to gunzip, then parse the XML file as json - push the JSON to the parsedXmlArray - then resolve the promise to move to the next item
                let processCompressedXmlFile = (sitemapUrl) => {
                    return new Promise((resolve, reject) => {
                        // console.log("Processing Compressed XML Sitemap: ", sitemapUrl);

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
                                        // Push the JSON to our array
                                        parsedXmlArray.push(result);

                                        // Resolve the promise to move onto the next item
                                        setTimeout(() => {
                                            resolve();
                                        }, 1);
                                        
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

                promises.then(result => {
                    // console.log("Done getting batch of " + parsedXmlArray.length + " compressed XML sitemaps.");
                    resolve(parsedXmlArray);
                })
                .catch(err => {
                    console.log("Promises error: ", err);
                    reject(err);
                })
            });
        }
    });
}

module.exports = {
    sitemapUrlScraper
}