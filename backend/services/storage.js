const { Storage } = require('@google-cloud/storage');

// raw_text lives in Cloud Storage when RAW_TEXT_BUCKET is set; otherwise it stays inline in Mongo (local dev).
let storage = null;
function bucket() {
  if (!storage) storage = new Storage();
  return storage.bucket(process.env.RAW_TEXT_BUCKET);
}

function parseGcsUri(uri) {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri || '');
  if (!m) throw new Error(`Invalid gcs_uri: ${uri}`);
  return { bucket: m[1], object: m[2] };
}

// Returns the fields to $set on the Content doc.
async function saveRawText(contentId, text) {
  if (!process.env.RAW_TEXT_BUCKET) return { raw_text: text };
  const object = `raw_text/${contentId}.txt`;
  await bucket().file(object).save(text, { contentType: 'text/plain; charset=utf-8', resumable: false });
  return { gcs_uri: `gs://${process.env.RAW_TEXT_BUCKET}/${object}` };
}

async function loadRawText(content) {
  if (content.gcs_uri) {
    const { bucket: b, object } = parseGcsUri(content.gcs_uri);
    const [buf] = await (storage || (storage = new Storage())).bucket(b).file(object).download();
    return buf.toString('utf8');
  }
  return content.raw_text || (content.chunks || []).join('\n\n');
}

module.exports = { saveRawText, loadRawText, parseGcsUri };
