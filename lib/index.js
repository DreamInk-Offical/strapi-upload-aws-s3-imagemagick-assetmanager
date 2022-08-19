'use strict';

/**
 * Module dependencies
 */

const AWS = require('aws-sdk');
const Sharp = require('sharp');
const streamToBuffer = require('fast-stream-to-buffer');

module.exports = {
  init({ imageSizes, optimizeOptions, settings, ...config }) {
    const S3 = new AWS.S3({
      apiVersion: '2006-03-01',
      ...config,
    });

    function getFileType(file) {
      let fileType = 'origin';
      if (file.hash.split('_')[0] === 'thumbnail') {
        fileType = 'thumbnail';
      }
      return fileType;
    }

    function getFileFormat(file) {
      let fileFormat = 'file';
      const ext = file.ext.toLowerCase();
      if (
        ext === '.jpg' ||
        ext === '.jpeg' ||
        ext === '.png' ||
        ext === '.tif' ||
        ext === '.tiff' 
      ) {
        fileFormat = 'image';
      } else if(ext === '.svg') {
        fileFormat = 'icon';
      }
      return fileFormat;
    }

    function logic(file, customParams = {}) {
      return new Promise(async (resolve, reject) => {
        const fileType = getFileType(file);
        const fileFormat = getFileFormat(file);
        
        if(fileFormat === 'image') {
          const buffers = [];
          if (fileType !== 'thumbnail') {
            buffers.push({
              buffer: file.buffer,
              path: `${fileType}/${file.hash}${file.ext}`,
              mime: file.mime,
              isOrigin: true
            });
          }

          if (fileType !== 'thumbnail') {
            for (let size of imageSizes) {
              let buffer = file.buffer;
              let path = `${size.name}/${file.hash}${file.ext}`;
              let mime = file.mime;

              if (file.ext === '.jpeg' || file.ext === '.jpg') {
                buffer = await Sharp(file.buffer)
                  .withMetadata()
                  .jpeg(optimizeOptions.jpeg)
                  .resize(size.resizeOptions || {})
                  .rotate()
                  .toBuffer();
              } else if(file.ext === '.png') {
                buffer = await Sharp(file.buffer)
                  .png(optimizeOptions.png)
                  .resize(size.resizeOptions || {})
                  .rotate()
                  .toBuffer();
              } else if(file.ext === '.tiff' || file.ext === '.tif') {
                buffer = await Sharp(file.buffer)
                  .tiff(optimizeOptions.tiff)
                  .toColourspace('rgb16')
                  .resize(size.resizeOptions || {})
                  .rotate()
                  .toBuffer();
              }
              strapi.log.info(`🔄 Generated ${fileFormat}s/${size.name}/${file.name}${file.ext}`);

              buffers.push({
                buffer,
                path,
                mime,
              });
            }
          }

          for (let item of buffers) {
            await upload(file, customParams, item);
          }
          resolve();
        } else {
          await upload(file, customParams);
          resolve();
        }
      });
    };


    const upload = (file, customParams = {}, item = {}) =>
      new Promise((resolve, reject) => {
        const path = (file.path && item.path) ? `${file.path}/${item.path}` : (item.path ? `${item.path}` : (file.path ? `${file.path}/${file.hash}${file.ext}` : `${file.hash}${file.ext}`))
        const buffer = item.buffer ? item.buffer : file.buffer;
        const contentType = item.mime ? `${item.mime}` : `${file.mime}`;

        S3.upload(
          {
            Key: `${path}`,
            Body: Buffer.from(buffer, 'binary'),
            ACL: 'public-read',
            ContentType: `${contentType}`,
            ...customParams,
          },

          (err, data) => {
            if (err) return reject(err);

            strapi.log.info(`✅ Uploaded ${data.Location}`);
            file.url = data.Location;
            resolve();
          }
        );
      });

      const remove = (file, customParams = {}, element = {}) =>
      new Promise((resolve, reject) => {
        const path = (file.path && element.path) ? `${file.path}/${element.path}` : (element.path ? `${element.path}` : (file.path ? `${file.path}/${file.hash}${file.ext}` : `${file.hash}${file.ext}`))

        S3.deleteObject(
          { 
            Key: `${path}`,
            ...customParams, 
          },
          (err, data) => {
            if (err) { console.error(err); return; }
            strapi.log.info(`❌ Deleted ${file.url}`);
            resolve();
          }
        )

      });

    return {
      uploadStream(file, customParams = {}) {
        streamToBuffer(file.stream, function (err, buffer) {
          file.buffer = buffer;
          logic(file, customParams = {});
        })
      },      
      
      upload(file, customParams = {}) {
          logic(file, customParams = {});
      },

      delete(file, customParams = {}) {
        const fileType = getFileType(file);
        const fileFormat = getFileFormat(file);

        return new Promise(async (resolve, reject) => {
          if(fileFormat === 'image') {
            let element = {};
            element.path = `${fileType}/${file.hash}${file.ext}`;
            await remove(file, customParams, element);
            
            if (file.hash.split('_')[0] !== 'thumbnail') {
              for (let size of imageSizes) {
                let element = {};
                element.path = `${size.name}/${file.hash}${file.ext}`;
                await remove(file, customParams, element);
              }
            }
          } else {
            await remove(file, customParams);
          }

          resolve();
        });
      },
    };
  },
};
