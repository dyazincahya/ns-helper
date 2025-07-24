# API Service
This service can helping you to request data to server

## Dependencies
- [ApplicationSettings](https://docs.nativescript.org/core/application-settings)
- [@klippa/nativescript-http](https://www.npmjs.com/package/@klippa/nativescript-http)
- [@nativescript/secure-storage](https://www.npmjs.com/package/@nativescript/secure-storage)
- [atob](https://developer.mozilla.org/en-US/docs/Web/API/Window/atob)

## Using

### Initialization
``` javascript
global.baseUrl = "YOUR_BASE_URL";
global.tokenKey = "YOUR_TOKEN_API";
```

### Example
``` javascript
import * as ApiService from "~/api-service";

const cacheOptions = {
  useCache: false, // Set true if you want cache request
  cacheKey: 'my_cache', // cache key
  maxAgeInDays: 1, // Age of cache
  forceFetch: false, // Set true if want skip caching
};

ApiService.get(PATH_URL, cacheOptions)
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.log(error)
  });
```
