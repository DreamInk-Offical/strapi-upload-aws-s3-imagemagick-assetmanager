'use strict';

/**
 * Module dependencies
 */

// Public node modules.
const { pipeline } = require('stream');
const path = require('path');
const fs = require('fs-extra');
const imagemagickCli = require('imagemagick-cli');
const AWS = require('aws-sdk');

const UPLOADS_FOLDER_NAME = 'uploads';
const TEMP_FOLDER_NAME = 'temp';

module.exports = {
  init({ imageSizes, optimizeOptions, settings, ...config }) {
    // Init AWS
    const S3 = new AWS.S3({
      apiVersion: '2006-03-01',
      ...config,
    });

    // Ensure uploads folder exists
    const uploadPath = path.resolve(strapi.dirs.static.public, UPLOADS_FOLDER_NAME);
    if (!fs.pathExistsSync(uploadPath)) {
      throw new Error(
        `The upload folder (${uploadPath}) doesn't exist or is not accessible. Please make sure it exists.`
      );
    }

    // Create Temp Folder
    const tempDir = path.resolve(strapi.dirs.static.public, `${UPLOADS_FOLDER_NAME}/${TEMP_FOLDER_NAME}`);
    const createTemp = fs.ensureDir(tempDir);

    // Get File Type
    function getFileType(file) {
      let fileType = 'origin';
      if (file.hash.split('_')[0] === 'thumbnail') {
        fileType = 'thumbnail';
      }
      return fileType;
    }
    
    // Get File Format
    function getFileFormat(file) {
      let fileFormat = 'file';
      const ext = file.ext.toLowerCase();
      if (
        ext === '.jpg' ||
        ext === '.jpeg' ||
        ext === '.png' ||
        ext === '.tif' ||
        ext === '.tiff' ||
        ext === '.exr' 
      ) {
        fileFormat = 'image';
      } else if(ext === '.svg') {
        fileFormat = 'icon';
      }
      return fileFormat;
    }

    // Delete Logic
    function deleteLogic(file, customParams = {}) {
      return new Promise(async (resolve, reject) => {
        // Delete Files
        let getDeleteExternal = await getDeleteAWS(file);
      });
    };

    function getDeleteAWS(file) {
      return new Promise(async (resolve, reject) => {
        const fileType = getFileType(file);
        const fileFormat = getFileFormat(file);
        
        if(fileFormat === 'image') {
          // Original Image
          file.pathAWS = `original/${file.hash}_original${file.ext}`;
          await deleteAWS(file);

          // Size variations
          if (file.hash.split('_')[0] !== 'thumbnail') {
            for (let size of imageSizes) {
              file.pathAWS = `${size.name}/${file.hash}_${size.name}${file.ext}`;
              await deleteAWS(file);
            }
          }
        } else {
          // File 
          file.pathAWS = `file/${file.hash}_file${file.ext}`;
          await deleteAWS(file);
        }
        resolve();
      });
    };

    // Delete AWS
    function deleteAWS(file, customParams = {}) {
      return new Promise((resolve, reject) => {
          const path = (file.path && file.pathAWS) ? `${file.path}/${file.pathAWS}` : (file.pathAWS ? `${file.pathAWS}` : (file.path ? `${file.path}/${file.hash}${file.ext}` : `${file.hash}${file.ext}`))
          
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
        resolve();
      });
    };
  
    // Upload Logic
    function uploadLogic(file, customParams = {}) {
      return new Promise(async (resolve, reject) => {
        createTemp;
        // Upload Image
        let localOriginal;
        if (file.stream){
          localOriginal = await uploadLocalStream(file, customParams = {});
        } else {
          localOriginal = await uploadLocal(file, customParams = {});
        }
        // Use this Image to create other sizes LOOP
        // Save these Sizes inside temp Folder
        let localSizes = await uploadLocalSizes(localOriginal);
        // // Get file stream for each size
        let streams = await getStreams(localSizes);
        // // Upload and remove
        let uploadExternal = await uploadAWS(streams);
      });
    };

    function uploadLocalStream(file, customParams = {}) {
      return new Promise((resolve, reject) => {
        let fileType = getFileType(file);
        let fileFormat = getFileFormat(file);
        let endpoint = `https://${config.endpoint}/${config.params.Bucket}`;
        if(fileFormat === 'image') {
          pipeline(
            file.stream,
            fs.createWriteStream(path.join(`${uploadPath}/temp/`, `${file.hash}_original${file.ext}`)), (err) => {
              if (err) { return reject(err); }

              let origPathAWS = `original/${file.hash}_original${file.ext}`;
              file.url = (file.path && origPathAWS) ? `${endpoint}/${file.path}/${origPathAWS}` : (origPathAWS ? `${endpoint}/${origPathAWS}` : (file.path ? `${endpoint}/${file.path}/${file.hash}${file.ext}` : `${endpoint}/${file.hash}${file.ext}`))
              file.pathLocal = `${tempDir}/${file.hash}_original${file.ext}`;
             
              if (fileType == 'thumbnail') { removeTemp(file.pathLocal);} 
              resolve(file);
            }
          );
        } else {
          pipeline(
            file.stream,
            fs.createWriteStream(path.join(`${uploadPath}/temp/`, `${file.hash}_file${file.ext}`)), (err) => {

              if (err) { return reject(err); }
              let origPathAWS = `file/${file.hash}_file${file.ext}`;
              file.url = (file.path && origPathAWS) ? `${endpoint}/${file.path}/${origPathAWS}` : (origPathAWS ? `${endpoint}/${origPathAWS}` : (file.path ? `${endpoint}/${file.path}/${file.hash}${file.ext}` : `${endpoint}/${file.hash}${file.ext}`))
              file.pathLocal = `${tempDir}/${file.hash}_file${file.ext}`;
              
              if (fileType == 'thumbnail') { removeTemp(file.pathLocal);} 
              resolve(file);
            }
          );
        }


      });
    };

    function uploadLocal(file, customParams = {}) {
      return new Promise((resolve, reject) => {
        let fileType = getFileType(file);
        let fileFormat = getFileFormat(file);
        let endpoint = `https://${config.endpoint}/${config.params.Bucket}`;

        // If Image
        if(fileFormat === 'image') {
          if (fileType !== 'thumbnail') {
            fs.writeFile(path.join(`${uploadPath}/temp/`, `${file.hash}_original${file.ext}`), file.buffer, (err) => {
              if (err) { return reject(err); }

              // file.url = `/${UPLOADS_FOLDER_NAME}/temp/${file.hash}_original${file.ext}`;
              let origPathAWS = `original/${file.hash}_original${file.ext}`;
              file.url = (file.path && origPathAWS) ? `${endpoint}/${file.path}/${origPathAWS}` : (origPathAWS ? `${endpoint}/${origPathAWS}` : (file.path ? `${endpoint}/${file.path}/${file.hash}${file.ext}` : `${endpoint}/${file.hash}${file.ext}`))
              file.pathLocal = `${tempDir}/${file.hash}_original${file.ext}`;
              resolve(file);
            });
          }
        } else {
          // If file
          fs.writeFile(path.join(`${uploadPath}/temp/`, `${file.hash}_file${file.ext}`), file.buffer, (err) => {
            if (err) { return reject(err); }

            let origPathAWS = `file/${file.hash}_file${file.ext}`;
            file.url = (file.path && origPathAWS) ? `${endpoint}/${file.path}/${origPathAWS}` : (origPathAWS ? `${endpoint}/${origPathAWS}` : (file.path ? `${endpoint}/${file.path}/${file.hash}${file.ext}` : `${endpoint}/${file.hash}${file.ext}`))
            file.pathLocal = `${tempDir}/${file.hash}_file${file.ext}`;
            resolve(file);
          });
        }
      });
    };

    function uploadLocalSizes(localOriginal){
      return new Promise((resolve, reject) => {
        let fileType = getFileType(localOriginal);
        let fileFormat = getFileFormat(localOriginal);
        let iterations = imageSizes.length;
        let mime = localOriginal.mime;
        let hash = localOriginal.hash;
        let ext = localOriginal.ext;
        let path = localOriginal.path;
        let files = [];

        if(fileFormat === 'image') {
          // Original Image
          let pathAWS = `original/${localOriginal.hash}_original${localOriginal.ext}`;
          let pathLocal = `${tempDir}/${localOriginal.hash}_original${localOriginal.ext}`;
          files.push({path, pathAWS ,pathLocal ,mime, hash, ext});

          // Size variations
          if (fileType !== 'thumbnail') {
            for (let size of imageSizes) {
              let pathAWS = `${size.name}/${localOriginal.hash}_${size.name}${localOriginal.ext}`;
              let pathLocal = `${tempDir}/${localOriginal.hash}_${size.name}${localOriginal.ext}`;

              files.push({path, pathAWS,pathLocal,mime, hash, ext});

              // Image Options
              let imgOption = {};
              imgOption.options = size.resizeOptions.options || '';
              
              if (localOriginal.ext === '.jpeg' || localOriginal.ext === '.jpg') {
                imagemagickCli.exec(`magick convert ${localOriginal.pathLocal} ${imgOption.options} ${pathLocal}`)
                              .then(({ stdout, stderr }) => {if (!--iterations){resolve(files); strapi.log.info(`🔄 Generated all Sizes`);}})
              } else if(localOriginal.ext === '.png') {
                imagemagickCli.exec(`magick convert ${localOriginal.pathLocal} ${imgOption.options} ${pathLocal}`)
                              .then(({ stdout, stderr }) => {if (!--iterations){resolve(files); strapi.log.info(`🔄 Generated all Sizes`);}})
              } else if(localOriginal.ext === '.tiff' || localOriginal.ext === '.tif') {
                imagemagickCli.exec(`magick convert ${localOriginal.pathLocal} ${imgOption.options} ${pathLocal}`)
                              .then(({ stdout, stderr }) => {if (!--iterations){resolve(files); strapi.log.info(`🔄 Generated all Sizes`);}})
              } else if(localOriginal.ext === '.exr') {
                imagemagickCli.exec(`magick convert ${localOriginal.pathLocal} ${imgOption.options} ${pathLocal}`)
                              .then(({ stdout, stderr }) => {if (!--iterations){resolve(files); strapi.log.info(`🔄 Generated all Sizes`);}})
              }
            }
          }
        } else {
          // File
          let pathAWS = `file/${localOriginal.hash}_file${localOriginal.ext}`;
          let pathLocal = `${tempDir}/${localOriginal.hash}_file${localOriginal.ext}`;

          files.push({path, pathAWS ,pathLocal ,mime, hash, ext});
          resolve(files);
        }


      });
    }

    function getStreams(localSizes) {
      return new Promise((resolve, reject) => {
        const files = [];
        
        for (let item of localSizes) {
          // let buffer = fs.readFileSync(itemPath);
          let mime = item.mime;
          let pathAWS = item.pathAWS;
          let path = item.path;
          let hash = item.hash;
          let ext = item.ext;
          let stream = fs.createReadStream(item.pathLocal);

          files.push({path,pathAWS,mime,hash,ext,stream});
        }
        resolve(files);
      });
    };



    function uploadAWS(files, customParams = {}) {
      return new Promise((resolve, reject) => {
        for (let file of files) {
          const path = (file.path && file.pathAWS) ? `${file.path}/${file.pathAWS}` : (file.pathAWS ? `${file.pathAWS}` : (file.path ? `${file.path}/${file.hash}${file.ext}` : `${file.hash}${file.ext}`))

          S3.upload(
            {
              Key: `${path}`,
              Body: file.stream,
              ACL: 'public-read',
              ContentType: `${file.mime}`,
              ...customParams,
            },
  
            (err, data) => {
              if (err) return reject(err);
  
              strapi.log.info(`✅ Uploaded ${data.Location}`);
              file.url = data.Location;
              removeTemp(file.stream.path);
            }
          );
        }
        resolve();
      });
    };

    function removeTemp(file) {
      return new Promise((resolve, reject) => {
        fs.unlinkSync(file) 
        resolve();
      });
    };

    return {
      uploadStream(file, customParams = {}) {
        uploadLogic(file, customParams = {});
      },

      upload(file, customParams = {}) {
        uploadLogic(file, customParams = {});
      },

      delete(file, customParams = {}) {
        deleteLogic(file, customParams = {});
      },
    };
  },
};
