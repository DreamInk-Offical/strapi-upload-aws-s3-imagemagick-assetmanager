# strapi-upload-aws-s3-imagemagick

## Links

- [Strapi website](https://strapi.io/)
- [Strapi documentation](https://docs.strapi.io)
- [Strapi community on Discord](https://discord.strapi.io)
- [Strapi news on Twitter](https://twitter.com/strapijs)

## Installation

This plugin uses imagemagick cli. It could happen that some cli commands need to be adapted based on your operation system
install imagemagick (used: ImageMagick-7.1.0-46-Q16-HDRI-x64-dll)
- [Image Magick](https://imagemagick.org/script/download.php)

Using npm
```
npm install https://github.com/DreamInk-Offical/strapi-upload-aws-s3-imagemagick.git --save
```

## Configuration

- `provider` defines the name of the provider
- `providerOptions` is passed down during the construction of the provider. (ex: `new AWS.S3(config)`). [Complete list of options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)
- `actionOptions` is passed directly to the parameters to each method respectively. You can find the complete list of [upload/ uploadStream options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property) and [delete options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObject-property)

See the [documentation about using a provider](https://docs.strapi.io/developer-docs/latest/plugins/upload.html#using-a-provider) for information on installing and using a provider. To understand how environment variables are used in Strapi, please refer to the [documentation about environment variables](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/optional/environment.html#environment-variables).

- `resizeOptions` can be found [here](https://imagemagick.org/script/magick.php)
- `optional commands - not integrated` can be found [here](https://imagemagick.org/script/command-line-tools.php)

### Provider Configuration

`./config/plugins.js`

```js
module.exports = ({ env }) => ({
  // ...
  upload: {
    config: {
      provider: 'strapi-upload-aws-s3-imageMagick',
      providerOptions: {
        accessKeyId: env('WASABI_ACCESS_KEY_ID'),
        secretAccessKey: env('WASABI_ACCESS_SECRET'),
        endpoint: env('WASABI_ENDPOINT'),
        params: {
          Bucket: env('WASABI_BUCKET'),
        },
        imageSizes: [
          {
            name: '2k',
            resizeOptions: {
              options: '-resize 2048x2048 -quality 100'
            }
          },
          {
            name: '4k',
            resizeOptions: {
              options: '-resize 4096x4096 -quality 100'
            }
          },
          {
            name: '8k',
            resizeOptions: {
              options: '-resize 8192x8192 -quality 100'
            }
          }          
        ],
      },
    },
  },
  // ...
});
```
### API Parameters
`/api/upload`
- [Strapi uploads](https://docs.strapi.io/developer-docs/latest/plugins/upload.html#examples)

| Parameter | Description |
| --- | --- |
| `files` | The file(s) to upload. The value(s) can be a Buffer or Stream. |
| `path (optional)` | The folder where the file(s) will be uploaded (json string - {"upload_path": "assets/id_123123"}. |
| `path (imageSizes)` | Specify image sizes (json string - {"upload_path": "assets/id_123123", "imageSizes": "8k,4k,2k"}. |
| `refId` | The ID of the entry which the file(s) will be linked to. |
| `ref` | The unique ID (uid) of the model which the file(s) will be linked to (see more below). |
| `source (optional)` | The name of the plugin where the model is located. |
| `field` | The field of the entry which the file(s) will be precisely linked to. |


### Security Middleware Configuration

Due to the default settings in the Strapi Security Middleware you will need to modify the `contentSecurityPolicy` settings to properly see thumbnail previews in the Media Library. You should replace `strapi::security` string with the object bellow instead as explained in the [middleware configuration](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/required/middlewares.html#loading-order) documentation.

`./config/middlewares.js`

```js
module.exports = [
  // ...
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'dl.airtable.com',
            'yourBucketName.s3.yourRegion.amazonaws.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'dl.airtable.com',
            'yourBucketName.s3.yourRegion.amazonaws.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  // ...
];
```

If you use dots in your bucket name, the url of the ressource is in directory style (`s3.yourRegion.amazonaws.com/your.bucket.name/image.jpg`) instead of `yourBucketName.s3.yourRegion.amazonaws.com/image.jpg`. Then only add `s3.yourRegion.amazonaws.com` to img-src and media-src directives.

## Required AWS Policy Actions

These are the minimum amount of permissions needed for this provider to work.

```json
"Action": [
  "s3:PutObject",
  "s3:GetObject",
  "s3:ListBucket",
  "s3:DeleteObject",
  "s3:PutObjectAcl"
],
```
