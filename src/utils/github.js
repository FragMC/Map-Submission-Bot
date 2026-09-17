import { Octokit } from '@octokit/rest';
import { config } from '../config.js';

const octokit = new Octokit({ auth: config.githubToken });

export async function getIcedSpearJson() {
  const { data } = await octokit.repos.getContent({
    owner: config.githubOwner,
    repo: config.githubRepo,
    path: config.icedspearJsonPath,
    ref: config.githubBranch,
  });
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { json: JSON.parse(content), sha: data.sha };
}

export async function updateIcedSpearJson(newJson, commitMessage) {
  const { sha } = await getIcedSpearJson();
  const content = Buffer.from(JSON.stringify(newJson, null, 2)).toString('base64');
  await octokit.repos.createOrUpdateFileContents({
    owner: config.githubOwner,
    repo: config.githubRepo,
    path: config.icedspearJsonPath,
    message: commitMessage,
    content,
    sha,
    branch: config.githubBranch,
  });
}

export async function addMapToIcedSpear(mapData, commitDescription) {
  const { json } = await getIcedSpearJson();
  // icedspear.json is expected to be an array or {maps: []} - handle both
  let maps = Array.isArray(json) ? json : json.maps || [];
  const id = mapData.id || `map-${Date.now()}`;
  maps.push({
    id,
    name: mapData.name,
    author: mapData.author,
    description: mapData.description,
    schematic_url: mapData.schematic_url,
    allow_remixing: mapData.allow_remixing || false,
    difficulty: null,
    verified: false,
    verified_no_cp: false,
    images: [],
    submitted_by: mapData.submitted_by,
    ticket_id: mapData.ticket_id,
    created_at: new Date().toISOString(),
  });
  const newJson = Array.isArray(json) ? maps : { ...json, maps };
  const commitMessage = `Add map ${id}: ${mapData.name}\n\nDescription: ${commitDescription}\n\nUpdate made with the help of generative AI`;
  await updateIcedSpearJson(newJson, commitMessage);
  return id;
}

export async function editMapInIcedSpear(id, { difficulty, verified, verified_no_cp }) {
  const { json } = await getIcedSpearJson();
  let maps = Array.isArray(json) ? json : json.maps || [];
  const map = maps.find(m => m.id === id);
  if (!map) throw new Error(`Map ${id} not found`);
  if (difficulty !== undefined) map.difficulty = difficulty;
  if (verified !== undefined) map.verified = verified;
  if (verified_no_cp !== undefined) map.verified_no_cp = verified_no_cp;
  const newJson = Array.isArray(json) ? maps : { ...json, maps };
  const desc = `Edit map ${id}: difficulty=${difficulty} verified=${verified} verified_no_cp=${verified_no_cp}`;
  await updateIcedSpearJson(newJson, `${desc}\n\nDescription: ${desc}\n\nUpdate made with the help of generative AI`);
  return map;
}

export async function addImagesToMap(id, imageUrls) {
  const { json } = await getIcedSpearJson();
  let maps = Array.isArray(json) ? json : json.maps || [];
  const map = maps.find(m => m.id === id);
  if (!map) throw new Error(`Map ${id} not found`);
  map.images = [...(map.images || []), ...imageUrls];
  const newJson = Array.isArray(json) ? maps : { ...json, maps };
  await updateIcedSpearJson(newJson, `Add images to ${id}\n\nDescription: Add ${imageUrls.length} image(s) to map ${id}\n\nUpdate made with the help of generative AI`);
  return map;
}

export async function removeImagesFromMap(id, imageUrls) {
  const { json } = await getIcedSpearJson();
  let maps = Array.isArray(json) ? json : json.maps || [];
  const map = maps.find(m => m.id === id);
  if (!map) throw new Error(`Map ${id} not found`);
  map.images = (map.images || []).filter(img => !imageUrls.includes(img));
  const newJson = Array.isArray(json) ? maps : { ...json, maps };
  await updateIcedSpearJson(newJson, `Remove images from ${id}\n\nDescription: Remove ${imageUrls.length} image(s) from map ${id}\n\nUpdate made with the help of generative AI`);
  return map;
}
