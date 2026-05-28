import * as core from '@actions/core';
import {Octokit} from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import md5File from 'md5-file';
import globby = require('globby');

export const uploadReleaseArtifacts = async (client: Octokit, uploadUrl: string, files: string[]): Promise<void> => {
  core.startGroup('Uploading release assets');
  for (const fileGlob of files) {
    const paths = await (globby as any)(fileGlob);
    if (paths.length === 0) {
      core.error(`No files found matching glob: ${fileGlob}`);
    }
    for (const filePath of paths) {
      core.info(`Uploading asset: ${filePath}`);
      const name = path.basename(filePath);
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        core.info(`Skipping ${filePath} because it is not a file`);
        continue;
      }

      const content = fs.readFileSync(filePath);
      const hash = await md5File(filePath);
      core.info(`MD5 hash for ${filePath}: ${hash}`);

      // The uploadUrl is an RFC 6570 URI template (e.g., .../assets{?name,label})
      // Strip the template part before using it.
      const cleanedUploadUrl = uploadUrl.split('{')[0];
      const url = new URL(cleanedUploadUrl);
      url.searchParams.set('name', name);

      await client.request({
        method: 'POST',
        url: url.toString(),
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': stats.size,
        },
        data: content,
      });
    }
  }
  core.endGroup();
};
