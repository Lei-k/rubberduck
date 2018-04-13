import { WS } from "../utils/websocket";
import { API } from "../utils/api";

export function updateData(data) {
  return {
    type: "UPDATE_DATA",
    payload: data
  };
}

export function createNewSession(data) {
  return {
    type: "CREATE_NEW_SESSION",
    payload: WS.createNewSession(data.params)
  };
}

export function setRepoDetails(data) {
  return {
    type: "SET_REPO_DETAILS",
    payload: data
  };
}

export function setFileTree(data) {
  return {
    type: "SET_FILE_TREE",
    payload: data
  };
}

export function callTree(data) {
  return {
    type: "CALL_TREE",
    payload: API.getTree(data)
  };
}

export function callDefinitions(data) {
  const { fileSha, filePath, lineNumber, charNumber } = data;
  return {
    type: "CALL_DEFINITIONS",
    payload: WS.getDefinition(fileSha, filePath, lineNumber, charNumber)
  };
}

export function callReferences(data) {
  const { fileSha, filePath, lineNumber, charNumber } = data;
  return {
    type: "CALL_REFERENCES",
    payload: WS.getReferences(fileSha, filePath, lineNumber, charNumber)
  };
}
