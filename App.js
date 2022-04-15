import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RhinoManager, RhinoInference, RhinoErrors } from "@picovoice/rhino-react-native";
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

export default function App() {
  const accessKey = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX==";
  const [state, setState] = useState({
    buttonText: "Start",
    buttonDisabled: false,
    rhinoText: "",
    isListening: false,
    isError: false,
    errorMessage: "",
  });
  const [rhinoManager, setRhinoManager] = useState();

  useEffect(() => {
    // load context
    createRhinoManager();

    return () => {
      if (rhinoManager) {
        rhinoManager.delete();
      }
    };
  }, []);

  const createRhinoManager = async () => {
    let modelUri;

    if (Platform.OS === "android") {
      modelUri = FileSystem.cacheDirectory + "smart_lighting_android.rhn";
      await FileSystem.downloadAsync(
        Asset.fromModule(require("./assets/smart_lighting_android.rhn")).uri,
        modelUri
      );
    } else if (Platform.OS === "ios") {
      modelUri = FileSystem.cacheDirectory + "smart_lighting_ios.rhn";
      await FileSystem.downloadAsync(
        Asset.fromModule(require("./assets/smart_lighting_ios.rhn")).uri,
        modelUri
      );
    } else {
      throw `Unsupported platform: ${Platform.OS}`;
    }

    // Convert file:/// URI to absolute filesystem path
    const modelPath = modelUri.substring(7);

    RhinoManager.create(accessKey, modelPath, inferenceCallback, (error) => {
      errorCallback(error.message);
    })
      .then((rhinoManager) => {
        setRhinoManager(rhinoManager);
      })
      .catch((err) => {
        let errorMessage = "";
        if (err instanceof RhinoErrors.RhinoInvalidArgumentError) {
          errorMessage = `${err.message}\nPlease make sure your accessKey '${accessKey}' is valid`;
        } else if (err instanceof RhinoErrors.RhinoActivationError) {
          errorMessage = "AccessKey activation error";
        } else if (err instanceof RhinoErrors.RhinoActivationLimitError) {
          errorMessage = "AccessKey reached its device limit";
        } else if (err instanceof RhinoErrors.RhinoActivationRefusedError) {
          errorMessage = "AccessKey refused";
        } else if (err instanceof RhinoErrors.RhinoActivationThrottledError) {
          errorMessage = "AccessKey has been throttled";
        } else {
          errorMessage = err.toString();
        }
        errorCallback(errorMessage);
      });
  };

  const inferenceCallback = (inference) => {
    setState((prevState) => ({
      ...prevState,
      rhinoText: prettyPrint(inference),
      buttonText: "Start",
      buttonDisabled: false,
      isListening: false,
    }));
  };

  const errorCallback = (error) => {
    setState((prevState) => ({
      ...prevState,
      isError: true,
      errorMessage: error,
    }));
  };

  const prettyPrint = (inference) => {
    let printText = `{\n    "isUnderstood" : "${inference.isUnderstood}",\n`;
    if (inference.isUnderstood) {
      printText += `    "intent" : "${inference.intent}",\n`;
      if (Object.entries(inference.slots).length > 0) {
        printText += '    "slots" : {\n';
        for (let [key, slot] of Object.entries(inference.slots)) {
          printText += `        "${key}" : "${slot}",\n`;
        }
        printText += "    }\n";
      }
    }
    printText += "}";
    return printText;
  };

  const startProcessing = async () => {
    if (state.isListening) {
      return;
    }

    setState((prevState) => ({
      ...prevState,
      buttonDisabled: true,
    }));

    let recordAudioRequest;
    if (Platform.OS == "android") {
      recordAudioRequest = requestRecordAudioPermission();
    } else {
      recordAudioRequest = new Promise(function (resolve, _) {
        resolve(true);
      });
    }

    recordAudioRequest.then((hasPermission) => {
      if (!hasPermission) {
        console.error("Required microphone permission was not granted.");
        return;
      }

      rhinoManager.process().then((didStart) => {
        if (didStart) {
          setState((prevState) => ({
            ...prevState,
            buttonText: "...",
            rhinoText: "",
            buttonDisabled: false,
            isListening: true,
          }));
        }
      });
    });
  };

  const requestRecordAudioPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: "Microphone Permission",
        message: "Rhino needs access to your microphone to make intent inferences.",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      errorCallback(err.toString());
      return false;
    }
  };

  return (
    <View style={[styles.container]}>
      <View style={styles.statusBar}>
        <Text style={styles.statusBarText}>Rhino</Text>
      </View>

      <View style={{ flex: 0.35, justifyContent: "center", alignContent: "center" }}>
        <TouchableOpacity
          style={{
            width: "50%",
            height: "50%",
            alignSelf: "center",
            justifyContent: "center",
            backgroundColor: state.isError ? "#cccccc" : "#377DFF",
            borderRadius: 100,
          }}
          onPress={() => startProcessing()}
          disabled={state.buttonDisabled || state.isError}
        >
          <Text style={styles.buttonText}>{state.buttonText}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, padding: 20 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            justifyContent: "center",
            padding: 30,
            backgroundColor: "#25187E",
          }}
        >
          <Text style={styles.rhinoText}>{state.rhinoText}</Text>
        </View>
      </View>
      {state.isError && (
        <View style={styles.errorBox}>
          <Text
            style={{
              color: "white",
              fontSize: 16,
            }}
          >
            {state.errorMessage}
          </Text>
        </View>
      )}
      <View style={{ flex: 0.08, justifyContent: "flex-end", paddingBottom: 25 }}>
        <Text style={styles.instructions}>Made in Vancouver, Canada by Picovoice</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    backgroundColor: "#F5FCFF",
  },
  subContainer: {
    flex: 1,
    justifyContent: "center",
  },
  statusBar: {
    flex: 0.2,
    backgroundColor: "#377DFF",
    justifyContent: "flex-end",
  },
  statusBarText: {
    fontSize: 18,
    color: "white",
    fontWeight: "bold",
    marginLeft: 15,
    marginBottom: 10,
  },
  buttonStyle: {
    backgroundColor: "#377DFF",
    borderRadius: 100,
  },
  buttonText: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  rhinoText: {
    flex: 1,
    flexWrap: "wrap",
    color: "white",
    fontSize: 20,
  },
  itemStyle: {
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
  },
  instructions: {
    textAlign: "center",
    color: "#666666",
  },
  errorBox: {
    backgroundColor: "red",
    borderRadius: 5,
    margin: 20,
    padding: 20,
    textAlign: "center",
  },
});
