const richTextFromMarkdown = require('@contentful/rich-text-from-markdown')
  .richTextFromMarkdown;
const _ = require('lodash');
const { createClient } = require('contentful-management');

// space = 3clx1a6lju87
// CMA = CFPAT-51T7UJSw-wmtMyF4LxhZmALLZCegLhwCc9j_tkZ1mEw
// contentful space migration -s 3clx1a6lju87 -e rich-text-migration -a CFPAT-51T7UJSw-wmtMyF4LxhZmALLZCegLhwCc9j_tkZ1mEw migration.js

const mimeType = {
  bmp: 'image/bmp',
  djv: 'image/vnd.djvu',
  djvu: 'image/vnd.djvu',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pbm: 'image/x-portable-bitmap',
  pgm: 'image/x-portable-graymap',
  png: 'image/png',
  pnm: 'image/x-portable-anymap',
  ppm: 'image/x-portable-pixmap',
  psd: 'image/vnd.adobe.photoshop',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  xbm: 'image/x-xbitmap',
  xpm: 'image/x-xpixmap',
  '': 'application/octet-stream'
};
const getContentType = url => {
  const index = url.lastIndexOf('.');
  const extension = index === -1 ? '' : url.substr(index + 1);
  return mimeType[extension];
};
const getFileName = url => {
  const index = url.lastIndexOf('/');
  const fileName = index === -1 ? '' : url.substr(index + 1);
  return fileName;
};

const ENV_NAME = 'rich-text-migration';

module.exports = function(migration, { makeRequest, spaceId, accessToken }) {
  const managementClient = createClient({ accessToken: accessToken });

  migration.transformEntries({
    contentType: 'lessonCopy',
    from: ['copy'],
    to: ['richtextCopy'],
    transformEntryForLocale: async function(fromFields, currentLocale) {
      // Get the "Lesson > *" modules that are linked to the "modules" field
      // the modules field itself isn't localized, but some of the links contained in the array point to localizable entries.
      const copy = fromFields.copy[currentLocale];
      // console.log('>>> [migration_new.js] copyEntry : ', copy)
      const richTextDocument = await richTextFromMarkdown(copy, async mdNode => {
        if (mdNode.type !== 'image') {
          return null;
        }
        // Create and asset and publish it
        const space = await managementClient.getSpace(spaceId);
        // Unfortunately, we can't pull the environment id from the context
        const environment = await space.getEnvironment(ENV_NAME);

        let asset = await environment.createAsset({
          fields: {
            title: {
              'en-US': mdNode.title
                ? mdNode.title + currentLocale
                : mdNode.alt + currentLocale
            },
            file: {
              'en-US': {
                contentType: getContentType(mdNode.url),
                fileName: getFileName(mdNode.url) + currentLocale,
                upload: `https:${mdNode.url}`
              }
            }
          }
        });
        asset = await asset.processForAllLocales({
          processingCheckWait: 4000
        });
        asset = await asset.publish();
        console.log(`published asset's id is ${asset.sys.id}`);
        return {
          nodeType: 'embedded-asset-block',
          content: [],
          data: {
            target: {
              sys: {
                type: 'Link',
                linkType: 'Asset',
                id: asset.sys.id
              }
            }
          }
        };
      });

      // console.log('>>> [migration_new.js] richTextDocument : ', richTextDocument)

      var result = {
        richtextCopy: {
          nodeType: 'document',
          content: richTextDocument.content,
          data: {}
        }
      };
      return result;

      

     
      
      
    }
  });
};