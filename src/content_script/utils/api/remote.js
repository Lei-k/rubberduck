import parse from "diffparser";
import { getGitService } from "../../adapters";
import * as CrashReporting from "../crashes";

let BaseGitRemoteAPI = {
  isRemoteAuthorized(isPrivate) {
    const decoded = this.getDecodedToken();
    if (decoded !== null) {
      // Oauth case: github + bitbucket. If username exists,
      // then remote is definitely authorized.
      const username = this.getRemoteUsername(decoded);

      if (username !== "" && username !== undefined) {
        return true;
      }
    }

    // Now this could be the github app scenario, where
    // the decoded JWT does not have the Oauth username, but
    // remote is still authorized via an app installation.
    if (getGitService() === "github" && isPrivate) {
      // Here, if the repo is public, we can return false. But if the
      // repo is private, we should try reaching the server, just in case
      // authentication is available.
      return true;
    }

    return false;
  },

  makePassthrough(uriPath) {
    const fixedPath = uriPath.replace("?", "%3F");
    const fullUri = `${this.getPassthroughPath()}${fixedPath}/`;
    return this.makeGetRequest(fullUri)
      .then(response => {
        // This is required for non-json responses, as the passthrough api
        // JSONifies them with the jsonified key
        const { data, headers } = response;
        const actual = data.jsonified || data;
        const { link: linkHeaders } = headers;
        const next = this.getNextPages(linkHeaders);
        return { data: actual, ...next };
      })
      .catch(error => {
        CrashReporting.catchException(error);
      });
  },

  makeRemoteCall(uriPath) {
    const fullUri = this.buildUrl(uriPath);
    return this.cacheOrGet(fullUri).catch(error => {
      CrashReporting.catchException(error);
    });
  },

  makeConditionalGet(uriPath, isPrivate) {
    if (this.isRemoteAuthorized(isPrivate)) {
      // If user is logged in with remote, we will send
      // this API call to pass through via backend.
      return this.makePassthrough(uriPath);
    } else {
      // Make call directly to remote using client IP address
      // for efficient rate limit utilisation.
      return this.makeRemoteCall(uriPath);
    }
  },

  getTreeCaller(repoDetails, page) {
    const { type } = repoDetails;

    switch (type) {
      case "pull":
        return this.getPRFiles(repoDetails, page);
      case "commit":
        return this.getCommitFiles(repoDetails);
      case "compare":
        return this.getCompareFiles(repoDetails);
      default:
        return this.getFilesTree(repoDetails);
    }
  },

  getTree(repoDetails) {
    return this.getTreeCaller(repoDetails, null);
  },

  getTreePages(repoDetails, pages) {
    const callers = pages.map(page => this.getTreeCaller(repoDetails, page));
    return Promise.all(callers).then(function(responses) {
      return responses.reduce(
        (result, current) => result.concat(current.data),
        []
      );
    });
  }
};

let GithubAPI = {
  getRemoteUsername(decoded) {
    return decoded.github_username;
  },

  getPassthroughPath() {
    return `github_passthrough/`;
  },

  buildUrl(path) {
    return `https://api.github.com/${path}`;
  },

  getPrivateErrorCodes() {
    return [401, 404];
  },

  getUrlBase(repoDetails) {
    const { username, reponame } = repoDetails;
    return `repos/${username}/${reponame}`;
  },

  getFilesTree(repoDetails) {
    const urlBase = this.getUrlBase(repoDetails);
    const { branch, isPrivate } = repoDetails;
    // TODO(arjun): check for default branch
    const nonNullBranch = branch || "master";
    const uriPath = `${urlBase}/git/trees/${nonNullBranch}?recursive=1`;
    return this.makeConditionalGet(uriPath, isPrivate);
  },

  getPRFiles(repoDetails, page) {
    const urlBase = this.getUrlBase(repoDetails);
    const { prId, isPrivate } = repoDetails;
    let pageParam = "";
    if (page) {
      pageParam = `?page=${page}`;
    }
    const uriPath = `${urlBase}/pulls/${prId}/files${pageParam}`;
    return this.makeConditionalGet(uriPath, isPrivate);
  },

  getCommitFiles(repoDetails) {
    const urlBase = this.getUrlBase(repoDetails);
    const { headSha, isPrivate } = repoDetails;
    const uriPath = `${urlBase}/commits/${headSha}`;
    return this.makeConditionalGet(uriPath, isPrivate).then(response => ({
      data: response.data.files
    }));
  },

  getCompareFiles(repoDetails) {
    const urlBase = this.getUrlBase(repoDetails);
    const { headSha, baseSha, isPrivate } = repoDetails;
    const uriPath = `${urlBase}/compare/${baseSha}...${headSha}`;
    return this.makeConditionalGet(uriPath, isPrivate).then(response => ({
      data: response.data.files
    }));
  },

  getPRInfo(repoDetails) {
    const urlBase = this.getUrlBase(repoDetails);
    const { isPrivate, prId } = repoDetails;
    const uriPath = `${urlBase}/pulls/${prId}`;
    return this.makeConditionalGet(uriPath, isPrivate);
  }
};

let BitbucketAPI = {
  getRemoteUsername(decoded) {
    return decoded.bitbucket_username;
  },

  getPassthroughPath() {
    return `bitbucket_passthrough/`;
  },

  buildUrl(path) {
    return `https://api.bitbucket.org/2.0/${path}`;
  },

  getPrivateErrorCodes() {
    return [403];
  },

  getParsedDiff(rawDiff) {
    const parsedDiff = parse(rawDiff);
    return parsedDiff.map(element => {
      let status = "modified";
      let filename = element.to;

      if (element.to === "/dev/null") {
        status = "deleted";
        filename = element.from;
      } else if (element.from === "/dev/null") {
        status = "added";
      } else if (element.to !== element.from) {
        status = "renamed";
      }

      return {
        filename,
        status,
        additions: element.additions,
        deletions: element.deletions
      };
    });
  },

  getPRFiles(repoDetails) {
    const { username, reponame, prId } = repoDetails;
    const uriPath = `repositories/${username}/${reponame}/pullrequests/${prId}/diff/`;
    return this.makeConditionalGet(uriPath).then(response => {
      return { data: this.getParsedDiff(response.data) };
    });
  },

  getFilesTree(repoDetails) {},

  getPRInfo(repoDetails) {}
};

const getRemote = () => {
  return process.env.TEST === "true" || getGitService() === "github"
    ? GithubAPI
    : BitbucketAPI;
};

const RemoteAPI = Object.assign(
  {},
  Object.assign({}, BaseGitRemoteAPI, getRemote())
);

export default RemoteAPI;
