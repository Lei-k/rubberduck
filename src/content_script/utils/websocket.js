import Store from "../store";
import { bindActionCreators } from "redux";
import WebSocketAsPromised from "websocket-as-promised";
import Authorization from "./authorization";
import * as DataActions from "../actions/dataActions";
import * as CrashReporting from "./crashes";
import * as AnalyticsUtils from "./analytics";

function exponentialBackoff(attempt, delay) {
  return Math.floor(Math.random() * Math.pow(2, attempt) * delay);
}

/**
 * Base class that has methods for a socket connection
 */
class BaseWebSocket {
  constructor() {
    this.wsp = null;
  }

  isConnected = () => {
    return this.wsp && this.wsp.isOpened;
  };

  isConnecting = () => {
    return this.wsp && this.wsp.isOpening;
  };

  createWebsocket = onClose => {
    const token = Authorization.getToken();

    if (this.wsp === null) {
      const rootUrl = Authorization.getBaseUrl();
      const baseWsUrl = rootUrl.replace("http", "ws");
      const wsUrl = `${baseWsUrl}sessions/?token=${token}`;

      this.wsp = new WebSocketAsPromised(wsUrl, {
        packMessage: data => JSON.stringify(data),
        unpackMessage: message => JSON.parse(message),
        attachRequestId: (data, requestId) =>
          Object.assign({ id: requestId }, data),
        extractRequestId: data => data && data.id
      });
      this.wsp.onClose.addListener(response => onClose(response));
    }
  };

  connectSocket = onClose => {
    this.createWebsocket(onClose);
    return this.wsp.open();
  };

  tearDown = () => {
    if (this.wsp !== null) {
      return this.wsp.close().then(() => (this.wsp = null));
    } else {
      // Socket was never actually created
      return new Promise((resolve, reject) => {
        resolve();
      });
    }
  };

  sendRequest = payload => {
    return new Promise((resolve, reject) => {
      this.wsp.sendRequest(payload).then(response => {
        // response can have result or error
        // call promise method accordingly
        if (response.error !== undefined) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  };

  setupListener = listener => {
    this.wsp.onPackedMessage.addListener(message => {
      // Console log if this will not be handled by a promise later
      if (message.id === undefined) {
        listener(message);
      }
    });
  };

  createPRSession = params => {
    const { organisation, name, pull_request_id, service } = params;
    return this.sendRequest({
      type: "session.create",
      payload: {
        organisation,
        name,
        service,
        pull_request_id
      }
    });
  };

  createCompareSession = params => {
    const { organisation, name, head_sha, base_sha, service } = params;
    return this.sendRequest({
      type: "session.create",
      payload: {
        organisation,
        name,
        service,
        head_sha,
        base_sha
      }
    });
  };

  createSession = params => {
    if (params.type === "pull") {
      return this.createPRSession(params);
    } else {
      return this.createCompareSession(params);
    }
  };

  getHover = (baseOrHead, filePath, lineNumber, charNumber) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}#L${lineNumber}#C${charNumber}`
    };
    return this.sendRequest({
      type: "session.hover",
      payload: queryParams
    });
  };

  getUsages = (baseOrHead, filePath, lineNumber, charNumber) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}#L${lineNumber}#C${charNumber}`
    };
    return this.sendRequest({
      type: "session.references",
      payload: queryParams
    });
  };

  getDefinition = (baseOrHead, filePath, lineNumber, charNumber) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}#L${lineNumber}#C${charNumber}`
    };
    return this.sendRequest({
      type: "session.definition",
      payload: queryParams
    });
  };

  getFileContents = (baseOrHead, filePath) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}`
    };
    return this.sendRequest({
      type: "session.file_contents",
      payload: queryParams
    }).then(response => ({ ...response, filePath, baseOrHead }));
  };
}

/**
 * The manager maintains the socket connection for a session
 * Ensures connectivity, handles session status updates
 */
class WebSocketManager {
  constructor() {
    this.isReady = false;
    this.reconnectAttempts = 0;
    this.sessionParams = {};
    this.ws = new BaseWebSocket();
    this.DataActions = bindActionCreators(DataActions, Store.dispatch);
  }

  dispatchStatus = (status, progress) => {
    this.DataActions.updateSessionStatus({ status, progress });
  };

  dispatchAndLog = (type, progress) => {
    this.dispatchStatus(type, progress);
    AnalyticsUtils.logSessionEvent(type);
  };

  statusUpdatesListener = message => {
    // This will trigger the UI states for session status
    const { status_update: status, progress } = message;
    this.dispatchAndLog(status, progress);

    if (status === "ready") {
      this.isReady = true;
    } else if (status === "error") {
      console.log("Error in creating session", message);
    }
  };

  setupListener = () => {
    this.ws.setupListener(message => {
      if (message.status_update !== undefined) {
        this.statusUpdatesListener(message);
      }
    });
  };

  reconnectIfRequired = () => {
    // We should reconnect if the socket connection was `ready`
    // and the server disconnected.
    if (!this.ws.isConnected() && this.isReady) {
      this.reconnectAttempts += 1;
      this.createSession().then(response => {
        this.reconnectAttempts = 0;
      });
    }
  };

  tryReconnection = () => {
    setTimeout(
      this.reconnectIfRequired,
      exponentialBackoff(this.reconnectAttempts, 1000)
    );
  };

  onSocketClose = closeResponse => {
    this.dispatchStatus("disconnected");

    if (!closeResponse.wasClean) {
      // This means we did not explicitly close the connection ourself
      this.tryReconnection();
    }
  };

  createConnection = () => {
    return new Promise((resolve, reject) => {
      this.dispatchStatus("connecting");
      this.ws
        .connectSocket(this.onSocketClose)
        .then(() => {
          this.isReady = false;
          this.setupListener();
          resolve();
        })
        .catch(err => {
          this.tryReconnection();
          reject(err);
        });
    });
  };

  tearDown = () => {
    this.isReady = false;
    return this.ws.tearDown();
  };

  isNoAccessError = error =>
    error.indexOf("Repository not found") >= 0 ||
    error.indexOf("Branch not found") >= 0 ||
    error.indexOf("Pull Request not found") >= 0;

  isLanguageUnsupported = error => error.indexOf("Language not supported") >= 0;

  createNewSession = params => {
    this.sessionParams = params;
    this.reconnectAttempts = 0;
    AnalyticsUtils.logSessionEvent("creating");

    return this.createSession()
      .then(response => {
        AnalyticsUtils.logSessionEvent("created");
        return response;
      })
      .catch(error => {
        if (error.error && this.isLanguageUnsupported(error.error)) {
          return this.dispatchAndLog("unsupported_language");
        } else if (error.error && this.isNoAccessError(error.error)) {
          return this.dispatchAndLog("no_access");
        } else if (error === "No session to be created") {
          return this.dispatchAndLog("no_session");
        } else {
          const excp = new Error(JSON.stringify(error));
          CrashReporting.catchException(excp);
          return this.dispatchAndLog("error");
        }
      });
  };

  isValidType = type =>
    ["pull", "file", "commit", "compare"].indexOf(type) >= 0;

  createSession = () => {
    // This method is called with params, and internally
    // we need to figure out which type of session this is
    const params = this.sessionParams;
    return this.tearDown()
      .then(this.createConnection)
      .then(() => {
        if (this.isValidType(params.type)) {
          this.dispatchStatus("creating");
          return this.ws.createSession(params);
        } else {
          return Promise.reject("No session to be created");
        }
      })
      .then(response => {
        return response.result;
      });
  };

  getLSCallHelper = (method, ...params) => {
    // We can only make these calls once ready
    if (this.isReady) {
      return method(...params);
    } else {
      return new Promise((resolve, reject) => {
        reject();
      });
    }
  };
}

export const WS = new WebSocketManager();