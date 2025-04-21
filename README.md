# BRAT
BRAT - Browser Remote Access Tool

### Overall Communication

![image](https://github.com/user-attachments/assets/100515cd-2efb-4d2a-a130-4c9a56943db7)

### Command/Response

![image](https://github.com/user-attachments/assets/b7b2e3c3-7447-4a28-8c31-25885ee55d0f)

## Usage

You can use the make file to easily get things going.

Run build-docker to perform a clean build:
```
make build-docker
```


If you are running it locally in a developement environment remember to:
```
wire gen ./config/injector.go
```

## Command Syntax

When sending commands there is a specific syntax that should be used.

#### **Syntax**
```
[MODULE].[COMMAND].(OPTIONAL | [VALUES])
```

#### **Available Commands**
|Module| Command | Argument | Response|
|--|--|--|--|
| N/A | `ping` |N/A | `pong` |
| `recon`| `browser_info` |N/A | Basic browser info |
| `recon` | `capture_cookies` |N/A | Returns all cookies that don't have `HTTPOnly` set |
| `recon` | `screen_info` |N/A | Returns info about the users screen (eg: dimensions) |
| `recon` | `location_info` |N/A | Returns basic information about the users location |
| `dom` | `get_elements` | Element type to retrieve (eg: `head`) | Returns details about the matched elements |
|`dom`|`inject_script`|Script location (eg: `http://localhost/foo.js`) | Returns a success or failure response |
|`storage` | `get_local_storage` | N/A | Returns the contents of local storage |
| `storage` | `get_session_storage` | N/A | Returns the contents of session storage |
| `storage` | `set_local_storage` | Key pair value (eg: `Foo:Bar` | Returns success or failure response |
| `net` | `fetch` | Target resource (eg: `https://google.com`) | Returns a success or failure response |
|`net` | `web_socket_info` | N/A | Returns debug information about the websocket connection |
|`exec` | `eval` | Javascript to run (eg: `alert(1)`) | Returns an empty response if successful |
| `remote_view` | `start` | N/A | Starts a remote view from the perspective of the agent that updates every 5 seconds.
| `remote_view` | `stop` | N/A | Ends the remote view session, and agent will no longer report back the HTML that is currently loaded.



