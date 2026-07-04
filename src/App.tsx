/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { UserRole, LandParcel, SurveyAssignment, LandDispute, LandApplication, NeighborNotification, IoTSensorFeed, DroneMission, ParcelStatus, LandUse, OwnerType, ParcelDocument, GeoFenceEvent } from "./types";
import {
  INITIAL_PARCELS,
  INITIAL_SURVEYS,
  INITIAL_DISPUTES,
  INITIAL_APPLICATIONS,
  INITIAL_NEIGHBOR_NOTIFICATIONS,
  INITIAL_IOT_SENSORS,
  INITIAL_DRONE_MISSIONS,
  INITIAL_GEOFENCE_EVENTS
} from "./data/mockData";
import { AuthUser } from "./data/users";
import Login from "./components/Login";
import { initDB, saveToIndexedDB, getFromIndexedDB, StoreNames, OfflineMutation, queueOfflineMutation, getQueuedMutations, removeFromQueue, clearQueue } from "./lib/indexedDb";
import GisMap from "./components/GisMap";
import CitizenPortal from "./components/CitizenPortal";
import SurveyorToolkit from "./components/SurveyorToolkit";
import DisputeCenter from "./components/DisputeCenter";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import ParcelDocumentRegistry from "./components/ParcelDocumentRegistry";
import DroneMissionControl from "./components/DroneMissionControl";
import GeoFenceAlertPanel from "./components/GeoFenceAlertPanel";
import NotaryPortal from "./components/NotaryPortal";
import { analyzeParcel } from "./lib/gemini";
import RegistrarPortal from "./components/RegistrarPortal";
import KeyboardShortcutsHelp from "./components/KeyboardShortcutsHelp";
import { generateId } from "./utils/helpers";
import {
  ShieldAlert, CheckCircle, Compass, Info, Sparkles, Database
} from "lucide-react";

export default function App() {
  // --- Persistent State Handlers ---
  const [parcels, setParcels] = useState<LandParcel[]>(() => {
    const saved = localStorage.getItem("lais_parcels");
    const parsed: LandParcel[] = saved ? JSON.parse(saved) : INITIAL_PARCELS;
    // ensure documents exist for back-compat
    return parsed.map((p) => {
      const initial = INITIAL_PARCELS.find((ip) => ip.upi === p.upi);
      return {
        ...p,
        documents: p.documents || (initial ? initial.documents : [])
      };
    });
  });

  const [assignments, setAssignments] = useState<SurveyAssignment[]>(() => {
    const saved = localStorage.getItem("lais_assignments");
    return saved ? JSON.parse(saved) : INITIAL_SURVEYS;
  });

  const [disputes, setDisputes] = useState<LandDispute[]>(() => {
    const saved = localStorage.getItem("lais_disputes");
    return saved ? JSON.parse(saved) : INITIAL_DISPUTES;
  });

  const [applications, setApplications] = useState<LandApplication[]>(() => {
    const saved = localStorage.getItem("lais_applications");
    return saved ? JSON.parse(saved) : INITIAL_APPLICATIONS;
  });

  const [notifications, setNotifications] = useState<NeighborNotification[]>(() => {
    const saved = localStorage.getItem("lais_notifications");
    return saved ? JSON.parse(saved) : INITIAL_NEIGHBOR_NOTIFICATIONS;
  });

  const [iotSensors] = useState<IoTSensorFeed[]>(INITIAL_IOT_SENSORS);
  const [droneMissions, setDroneMissions] = useState<DroneMission[]>(INITIAL_DRONE_MISSIONS);

  // --- Geo-Fence Events State ---
  const [geoFenceEvents, setGeoFenceEvents] = useState<GeoFenceEvent[]>(() => {
    const saved = localStorage.getItem("lais_geofence_events");
    return saved ? JSON.parse(saved) : INITIAL_GEOFENCE_EVENTS;
  });

  // --- Authentication State ---
  const [loggedInUser, setLoggedInUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("lais_auth_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem("lais_auth_user", JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem("lais_auth_user");
    }
  }, [loggedInUser]);

  // --- Network & Intermittent Offline Simulator States ---
  const [isSystemOffline, setIsSystemOffline] = useState(!navigator.onLine);
  const [isManualOffline, setIsManualOffline] = useState(false);
  const isOffline = isSystemOffline || isManualOffline;

  // Simulate periodic geo-fence events based on surveyor GPS
  useEffect(() => {
    if (!isOffline) {
      const interval = setInterval(() => {
        const activeSrv = assignments.find(a => a.status === "Active");
        if (!activeSrv) return;

        if (Math.random() > 0.6) return;

        const eventTypes: GeoFenceEvent["type"][] = ["entry", "exit", "proximity_alert", "breach"];
        const severities: GeoFenceEvent["severity"][] = ["info", "info", "warning", "critical"];
        const idx = Math.floor(Math.random() * eventTypes.length);

        const basePos: [number, number] = [340 + Math.floor(Math.random() * 80), 200 + Math.floor(Math.random() * 60)];
        const distances = [12, 45, 98, 4, 150, 210, 75];

        const messages: Record<GeoFenceEvent["type"], string> = {
          entry: `Surveyor GPS entered geofence zone (${activeSrv.geofenceRadius}m) around UPI ${activeSrv.upi}`,
          exit: `Surveyor GPS exited geofence zone. Signal handoff to secondary CORS base.`,
          proximity_alert: `Boundary beacon within ${distances[Math.floor(Math.random() * distances.length)]}m of adjacent parcel — verify alignment`,
          breach: `Geofence breach detected: Survey marker placement exceeds allowed boundary by ${Math.floor(2 + Math.random() * 6)}m`
        };

        const newEvent: GeoFenceEvent = {
          id: `gf-${Date.now()}-${generateId().substring(0, 4)}`,
          surveyId: activeSrv.id,
          type: eventTypes[idx],
          message: messages[eventTypes[idx]],
          timestamp: new Date().toISOString(),
          position: basePos,
          distance: distances[Math.floor(Math.random() * distances.length)],
          acknowledged: false,
          severity: severities[idx],
        };

        setGeoFenceEvents(prev => {
          const updated = [newEvent, ...prev].slice(0, 50);
          localStorage.setItem("lais_geofence_events", JSON.stringify(updated));
          return updated;
        });

        addToast(`Geo-Fence Alert: ${newEvent.message.substring(0, 55)}...`, newEvent.severity === "critical" ? "warning" : "info");
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [assignments, isOffline]);

  // Background Sync Queue States
  const [pendingSyncQueue, setPendingSyncQueue] = useState<OfflineMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Helper to refresh the local state representation of the sync queue
  const refreshPendingSyncQueue = async () => {
    try {
      const queue = await getQueuedMutations();
      setPendingSyncQueue(queue || []);
    } catch (err) {
      console.error("Failed to load background sync queue:", err);
    }
  };

  // Helper to record mutations offline
  const registerOfflineMutation = async (type: string, payload: any, description: string) => {
    const mut: OfflineMutation = {
      id: `mut-${Date.now()}-${generateId().substring(0, 7)}`,
      timestamp: Date.now(),
      type,
      payload,
      description
    };
    await queueOfflineMutation(mut);
    await refreshPendingSyncQueue();
    addToast(`Offline Queue: "${description}" logged.`, "info");
  };

  // Helper to replay queued mutations
  const replayQueuedMutations = async () => {
    try {
      const queue = await getQueuedMutations();
      if (!queue || queue.length === 0) return;

      setIsSyncing(true);
      addToast(`Replaying ${queue.length} background transactions to server...`, "info");

      // Small artificial delay to simulate secure endpoint handshaking and validation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      for (const mut of queue) {
        console.log(`[Replay Engine] Successfully synced offline mutation:`, mut);
        await new Promise((resolve) => setTimeout(resolve, 250));
        await removeFromQueue(mut.id);
      }

      await refreshPendingSyncQueue();
      setIsSyncing(false);
      addToast(`Background sync complete: All transactions integrated.`, "success");
    } catch (err) {
      console.error("Failed to replay queued mutations:", err);
      setIsSyncing(false);
    }
  };

  // Handle actual browser offline/online event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsSystemOffline(false);
      addToast("Network connection restored.", "success");
    };
    const handleOffline = () => {
      setIsSystemOffline(true);
      addToast("Network connection lost.", "warning");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Trigger auto-replay when transitioning online
  useEffect(() => {
    if (!isOffline) {
      replayQueuedMutations();
    }
  }, [isOffline]);

  // --- GLOBAL KEYBOARD SHORTCUTS ---
  const triggerCopilotRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    triggerCopilotRef.current = triggerCopilotAnalysis;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "?":
        case "h":
        case "H":
          e.preventDefault();
          setShowKeyboardHelp((p) => !p);
          break;
        case "Escape":
          setShowKeyboardHelp(false);
          setIsCollabExpanded(false);
          break;
        case "o":
        case "O":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setIsManualOffline((p) => !p);
          }
          break;
        case " ":
          e.preventDefault();
          triggerCopilotRef.current();
          break;
        case "c":
        case "C":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setIsCollabExpanded((p) => !p);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sync state items to IndexedDB on mutations
  useEffect(() => {
    if (parcels && parcels.length > 0) {
      saveToIndexedDB(StoreNames.PARCELS, parcels);
    }
  }, [parcels]);

  useEffect(() => {
    if (disputes && disputes.length > 0) {
      saveToIndexedDB(StoreNames.DISPUTES, disputes);
    }
  }, [disputes]);

  useEffect(() => {
    if (assignments && assignments.length > 0) {
      saveToIndexedDB(StoreNames.ASSIGNMENTS, assignments);
    }
  }, [assignments]);

  useEffect(() => {
    if (applications && applications.length > 0) {
      saveToIndexedDB(StoreNames.APPLICATIONS, applications);
    }
  }, [applications]);

  // Initial load of cached data from IndexedDB
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        await initDB();
        
        const cachedParcels = await getFromIndexedDB<LandParcel>(StoreNames.PARCELS);
        const cachedDisputes = await getFromIndexedDB<LandDispute>(StoreNames.DISPUTES);
        const cachedAssignments = await getFromIndexedDB<SurveyAssignment>(StoreNames.ASSIGNMENTS);
        const cachedApplications = await getFromIndexedDB<LandApplication>(StoreNames.APPLICATIONS);

        if (cachedParcels && cachedParcels.length > 0) {
          setParcels(cachedParcels);
          setSelectedParcel(cachedParcels[0]);
        } else {
          await saveToIndexedDB(StoreNames.PARCELS, INITIAL_PARCELS);
        }

        if (cachedDisputes && cachedDisputes.length > 0) {
          setDisputes(cachedDisputes);
        } else {
          await saveToIndexedDB(StoreNames.DISPUTES, INITIAL_DISPUTES);
        }

        if (cachedAssignments && cachedAssignments.length > 0) {
          setAssignments(cachedAssignments);
        } else {
          await saveToIndexedDB(StoreNames.ASSIGNMENTS, INITIAL_SURVEYS);
        }

        if (cachedApplications && cachedApplications.length > 0) {
          setApplications(cachedApplications);
        } else {
          await saveToIndexedDB(StoreNames.APPLICATIONS, INITIAL_APPLICATIONS);
        }

        // Load sync queue
        await refreshPendingSyncQueue();
      } catch (err) {
        console.error("Failed to initialize or retrieve from IndexedDB:", err);
      }
    };

    loadCachedData();
  }, []);

  // Portal State controls
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem("lais_auth_user");
    if (saved) {
      const u: AuthUser = JSON.parse(saved);
      return u.role;
    }
    return UserRole.CITIZEN;
  });
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(parcels[0] || null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activeCopilotAnalysis, setActiveCopilotAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Gemini API Key State (persisted)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem("lais_gemini_api_key") || "";
  });

  const handleSetGeminiApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem("lais_gemini_api_key", key);
  };

  // Keyboard Help State
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Live Toast Notifications Stack
  const [liveToasts, setLiveToasts] = useState<{ id: string; msg: string; type: "info" | "success" | "warning" }[]>([]);

  // --- Socket.IO Collaboration States ---
  const [socket, setSocket] = useState<any>(null);
  const [presence, setPresence] = useState<any[]>([]);
  const [cursors, setCursors] = useState<Record<string, any>>({});
  const [surveyorGps, setSurveyorGps] = useState<Record<string, any>>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isCollabConnected, setIsCollabConnected] = useState(false);
  const [mySessionId, setMySessionId] = useState<string>("");
  const [customUsername, setCustomUsername] = useState("");
  const [isCollabExpanded, setIsCollabExpanded] = useState(false);
  const [activeCollabTab, setActiveCollabTab] = useState<"chat" | "presence">("chat");
  const [chatInput, setChatInput] = useState("");

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketUrl = `${window.location.protocol}//${window.location.host}`;
    console.log("Connecting to Socket.IO collaboration server:", socketUrl);
    
    const newSocket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsCollabConnected(true);
      setMySessionId(newSocket.id || "");
      
      const userName = loggedInUser?.name || "Anonymous User";
      setCustomUsername(userName);

      newSocket.emit("join-session", {
        userId: loggedInUser?.nationalId || `user-${Math.floor(1000 + Math.random() * 9000)}`,
        name: userName,
        role: currentRole
      });
    });

    newSocket.on("init-state", (state: any) => {
      if (state.parcels && state.parcels.length > 0) setParcels(state.parcels);
      if (state.disputes && state.disputes.length > 0) setDisputes(state.disputes);
      if (state.assignments && state.assignments.length > 0) setAssignments(state.assignments);
      if (state.messages) setChatMessages(state.messages);
      if (state.presence) setPresence(state.presence);
    });

    newSocket.on("presence-update", (users: any[]) => {
      setPresence(users);
    });

    newSocket.on("chat-message", (msg: any) => {
      setChatMessages((prev) => [...prev, msg]);
      addToast(`New chat from ${msg.name}: "${msg.message.substring(0, 20)}..."`, "info");
    });

    newSocket.on("parcels-update", (updatedParcels: LandParcel[]) => {
      setParcels(updatedParcels);
    });

    newSocket.on("disputes-update", (updatedDisputes: LandDispute[]) => {
      setDisputes(updatedDisputes);
    });

    newSocket.on("cursor-moved", (data: any) => {
      setCursors((prev) => ({
        ...prev,
        [data.socketId]: data
      }));
    });

    newSocket.on("surveyor-gps-updated", (data: any) => {
      setSurveyorGps((prev) => ({
        ...prev,
        [data.socketId]: data
      }));
    });

    newSocket.on("disconnect", () => {
      setIsCollabConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Update server on name/role change
  useEffect(() => {
    if (socket && isCollabConnected) {
      const name = loggedInUser?.name || customUsername || "Anonymous User";

      socket.emit("join-session", {
        userId: loggedInUser?.nationalId || `user-${Math.floor(1000 + Math.random() * 9000)}`,
        name,
        role: currentRole
      });
    }
  }, [currentRole, socket, isCollabConnected, loggedInUser]);

  const handleUpdateNickname = (newName: string) => {
    setCustomUsername(newName);
    if (socket && isCollabConnected) {
      socket.emit("join-session", {
        userId: loggedInUser?.nationalId || `user-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newName,
        role: currentRole
      });
    }
  };

  const handleSendChatMessage = (text: string) => {
    if (!text.trim() || !socket) return;
    const name = customUsername || loggedInUser?.name || "Anonymous User";
    socket.emit("chat-message", {
      text,
      senderName: name,
      senderRole: currentRole
    });
  };

  const handleCursorMove = (coords: { x: number; y: number; lat: number; lon: number }) => {
    if (socket && isCollabConnected) {
      socket.emit("move-cursor", coords);
    }
  };

  const handleGPSUpdate = (coords: { x: number; y: number; lat: number; lon: number }) => {
    if (socket && isCollabConnected) {
      socket.emit("update-gps", coords);
    }
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem("lais_parcels", JSON.stringify(parcels));
  }, [parcels]);

  useEffect(() => {
    localStorage.setItem("lais_assignments", JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem("lais_disputes", JSON.stringify(disputes));
  }, [disputes]);

  useEffect(() => {
    localStorage.setItem("lais_applications", JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem("lais_notifications", JSON.stringify(notifications));
  }, [notifications]);

  // Push notifications helper
  const addToast = (msg: string, type: "info" | "success" | "warning" = "info") => {
    const id = generateId().substring(0, 7);
    setLiveToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setLiveToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // --- GEO-FENCE HANDLERS ---
  const handleAcknowledgeGeoFence = (eventId: string) => {
    setGeoFenceEvents(prev => {
      const updated = prev.map(e => e.id === eventId ? { ...e, acknowledged: true } : e);
      localStorage.setItem("lais_geofence_events", JSON.stringify(updated));
      return updated;
    });
    addToast(`Geo-fence alert acknowledged`, "success");
  };

  const handleClearGeoFenceEvents = () => {
    setGeoFenceEvents([]);
    localStorage.removeItem("lais_geofence_events");
    addToast("All geo-fence events cleared", "info");
  };

  const handleGeoFencePositionSelect = (pos: [number, number]) => {
    const matched = parcels.find(p =>
      p.polygon.some(pt => Math.abs(pt[0] - pos[0]) < 30 && Math.abs(pt[1] - pos[1]) < 30)
    );
    if (matched) {
      setSelectedParcel(matched);
      addToast(`GIS panned to parcel near geo-fence event coordinates`, "info");
    }
  };

  // Switch Selected Parcel on Map Selection
  const handleSelectParcel = (parcel: LandParcel | null) => {
    setSelectedParcel(parcel);
    if (parcel) {
      addToast(`Selected UPI Parcel: ${parcel.upi}`, "info");
      setActiveCopilotAnalysis(""); // Reset AI analysis on new selection
    }
  };

  // --- REGISTRY EVENTS ---

  // Add Land Application (e.g., Transfer request)
  const handleAddApplication = (newApp: LandApplication) => {
    setApplications((prev) => [newApp, ...prev]);
    addToast(`Submitted ${newApp.type} Application for Notary Verification`, "success");
    
    // Simulate Automatic Neighbor Geofence Warning if doing subdivision/mutation
    if (newApp.type === "Subdivision") {
      const associatedParcel = parcels.find(p => p.upi === newApp.upi);
      if (associatedParcel) {
        const newSurveyId = `srv-${Math.floor(100 + Math.random() * 900)}`;
        const newSurvey: SurveyAssignment = {
          id: newSurveyId,
          parcelId: associatedParcel.id,
          upi: associatedParcel.upi,
          requestorName: associatedParcel.ownerName,
          requestorPhone: "+250 788 " + Math.floor(100000 + Math.random() * 900000),
          assignedSurveyorId: "sv-101",
          assignedSurveyorName: "Pierre Claver Mugisha",
          district: associatedParcel.district,
          sector: associatedParcel.sector,
          cell: associatedParcel.cell,
          village: associatedParcel.village,
          status: "Pending",
          requestedDate: new Date().toISOString().split("T")[0],
          geofenceRadius: 250,
          beaconsConfirmed: 0,
          voiceNotesCount: 0,
        };
        setAssignments((prev) => [newSurvey, ...prev]);
        addToast(`Dispatched Mutation Survey Assignment: ${newSurveyId}`, "info");

        // Seed neighbor geofence notification lists
        const neighbors = parcels.filter(p => p.id !== associatedParcel.id && p.sector === associatedParcel.sector);
        neighbors.forEach((n, idx) => {
          const notifId = `ntf-${Math.floor(1000 + Math.random() * 9000)}`;
          const newNotif: NeighborNotification = {
            id: notifId,
            surveyId: newSurveyId,
            neighborUpi: n.upi,
            neighborName: n.ownerName,
            neighborPhone: "+250 78" + Math.floor(1000000 + Math.random() * 9000000),
            distance: Math.round(120 + idx * 45),
            status: "Sent"
          };
          setNotifications((prev) => [newNotif, ...prev]);
        });
      }
    }

    if (isOffline) {
      registerOfflineMutation("ADD_APPLICATION", { newApp }, `Submitted ${newApp.type} application for ${newApp.applicantName}`);
    }
  };

  // Pay Application Fees
  const handlePayApplication = (appId: string, receipt: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, paymentStatus: "Paid", paymentReceipt: receipt, status: "Pending Notary" } : a))
    );
    addToast(`Payment Confirmed via Irembo: ${receipt}. Forwarded to Notary for PKI verification.`, "success");

    if (isOffline) {
      registerOfflineMutation("PAY_APPLICATION", { appId, receipt }, `Paid fees for application ${appId}`);
    }
  };

  // Notary: Verify applicant identities against NIDA
  const handleNotaryVerifyIdentity = (appId: string) => {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          const verifiedDocs = a.documents.map(d => ({ ...d, status: "Verified" as const }));
          return { ...a, documents: verifiedDocs };
        }
        return a;
      })
    );
    addToast(`Identity documents verified against NIDA database`, "success");
  };

  // Notary: Digitally sign and forward to District Approval
  const handleNotarySignAndForward = (appId: string) => {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          return { ...a, status: "Pending District Approval" };
        }
        return a;
      })
    );
    addToast(`Notary digital certificate applied. Forwarded for District Registrar approval.`, "success");

    if (isOffline) {
      registerOfflineMutation("NOTARY_SIGN", { appId }, `Notary signed application ${appId}`);
    }
  };

  // Notary: Reject application with reason
  const handleNotaryReject = (appId: string, reason: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: "Rejected" } : a))
    );
    addToast(`Application rejected by Notary: ${reason}`, "warning");

    if (isOffline) {
      registerOfflineMutation("NOTARY_REJECT", { appId, reason }, `Notary rejected application ${appId}: ${reason}`);
    }
  };

  // District Registrar: Send back to notary for revision
  const handleSendBackToNotary = (appId: string, reason: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: "Pending Notary" } : a))
    );
    addToast(`Application returned to Notary: ${reason}`, "warning");

    if (isOffline) {
      registerOfflineMutation("SEND_BACK_NOTARY", { appId, reason }, `Registrar sent application ${appId} back to notary: ${reason}`);
    }
  };

  // District Registrar: Final approval (completes the transfer)
  const handleRegistrarApprove = (appId: string) => {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          const targetUpi = a.upi;
          const buyerName = a.targetBuyerName;
          const buyerId = a.targetBuyerId;
          const receipt = a.paymentReceipt;

          if (targetUpi && buyerName && buyerId) {
            setParcels((currentParcels) =>
              currentParcels.map((p) => {
                if (p.upi === targetUpi) {
                  const newHist = {
                    date: new Date().toISOString().split("T")[0],
                    type: "Transfer" as const,
                    details: `Ownership transferred from ${p.ownerName} to ${buyerName}. Notary PKI verified. Irembo: ${receipt}.`,
                    actor: "District Registrar approved via digital certificate",
                    documentRef: receipt
                  };
                  return {
                    ...p,
                    ownerName: buyerName,
                    ownerId: buyerId,
                    ownerType: OwnerType.INDIVIDUAL,
                    history: [...p.history, newHist],
                    taxPaid: false
                  };
                }
                return p;
              })
            );
            addToast(`Title Mutation Completed! Ownership transferred for UPI ${targetUpi}.`, "success");
          }
          return { ...a, status: "Approved" };
        }
        return a;
      })
    );

    if (isOffline) {
      registerOfflineMutation("REGISTRAR_APPROVE", { appId }, `District Registrar approved application ${appId}`);
    }
  };

  // Pay Property Taxes
  const handlePayParcelTax = (parcelId: string) => {
    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? { ...p, taxPaid: true } : p))
    );
    addToast(`Property Tax cleared successfully for selected parcel!`, "success");

    if (isOffline) {
      registerOfflineMutation("PAY_TAX", { parcelId }, `Paid property tax for parcel ${parcelId}`);
    }
  };

  // Surveyor update survey assignment status & polygons
  const handleUpdateAssignmentStatus = (
    assignmentId: string,
    status: SurveyAssignment["status"],
    measuredPolygon?: [number, number][],
    measuredArea?: number
  ) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              status,
              measuredPolygon,
              measuredArea,
              surveyDate: new Date().toISOString().split("T")[0]
            }
          : a
      )
    );
    
    // Auto update parcel registry boundaries!
    const targetAssign = assignments.find(a => a.id === assignmentId);
    if (targetAssign && measuredPolygon && measuredArea) {
      setParcels((prev) =>
        prev.map((p) => {
          if (p.upi === targetAssign.upi) {
            const updatedP = {
              ...p,
              polygon: measuredPolygon,
              area: measuredArea,
              status: ParcelStatus.APPROVED,
              history: [
                ...p.history,
                {
                  date: new Date().toISOString().split("T")[0],
                  type: "Survey" as const,
                  details: `Electronic coordinate boundaries updated & verified by licensed surveyor Pierre Claver Mugisha.`,
                  actor: "Licensed Surveyor"
                }
              ]
            };
            if (socket && isCollabConnected) {
              socket.emit("edit-parcel", { parcel: updatedP });
            }
            return updatedP;
          }
          return p;
        })
      );
    }

    addToast(`Survey certified! Boundary vectors committed to coordinate registry.`, "success");

    if (isOffline) {
      registerOfflineMutation("UPDATE_ASSIGNMENT", { assignmentId, status, measuredPolygon, measuredArea }, `Updated survey assignment ${assignmentId} to ${status}`);
    }
  };

  // Confirm Beacons
  const onConfirmBeacon = (assignmentId: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId ? { ...a, beaconsConfirmed: a.beaconsConfirmed + 1 } : a
      )
    );
    addToast(`Coordinated RTK Beacon Placed & Confirmed`, "success");

    if (isOffline) {
      registerOfflineMutation("CONFIRM_BEACON", { assignmentId }, `Confirmed boundary beacon for survey assignment ${assignmentId}`);
    }
  };

  // Set Geofence Radius
  const onSetGeofenceRadius = (assignmentId: string, radius: number) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, geofenceRadius: radius } : a))
    );
    addToast(`Adjusted GeoFence alert radius to ${radius} meters`, "info");

    if (isOffline) {
      registerOfflineMutation("SET_GEOFENCE", { assignmentId, radius }, `Adjusted geofence to ${radius}m for assignment ${assignmentId}`);
    }
  };

  // Add Voice Note
  const onAddVoiceNote = (assignmentId: string) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, voiceNotesCount: a.voiceNotesCount + 1 } : a))
    );

    if (isOffline) {
      registerOfflineMutation("ADD_VOICE_NOTE", { assignmentId }, `Added field voice note to survey assignment ${assignmentId}`);
    }
  };

  // Add Notification neighbor response
  const onAddNotificationResponse = (
    notifId: string,
    response: "Attending" | "Reschedule_Requested" | "Objecting",
    notes: string
  ) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, status: "Confirmed", response, responseNotes: notes } : n))
    );
    
    if (response === "Objecting") {
      addToast(`Neighbor objection filed! Encroachment dispute log opened.`, "warning");
      
      // Auto register dispute file!
      const affectedNotif = notifications.find(n => n.id === notifId);
      const affectedSurvey = assignments.find(a => a.id === affectedNotif?.surveyId);
      if (affectedNotif && affectedSurvey) {
        const newDisp: LandDispute = {
          id: `dsp-${Math.floor(100000 + Math.random() * 900000)}`,
          parcelId: affectedSurvey.parcelId || "p1",
          upi: affectedSurvey.upi || "1/02/11/04/1841",
          claimantName: affectedNotif.neighborName,
          claimantId: "1198580045231109",
          claimantPhone: affectedNotif.neighborPhone,
          disputeType: "Boundary Encroachment",
          description: `Dispute raised during active field survey ${affectedSurvey.id}. Neighbor claims survey beacons encroach on border line of UPI ${affectedNotif.neighborUpi}.`,
          status: "Filed",
          filedDate: new Date().toISOString().split("T")[0],
          assignedOfficer: "Pending Assignment",
          evidenceDocs: []
        };
        setDisputes(prev => [newDisp, ...prev]);
        
        // Mutate parcel status to disputed
        setParcels(prev =>
          prev.map(p => p.upi === affectedSurvey.upi ? { ...p, status: ParcelStatus.DISPUTED } : p)
        );
      }
    } else {
      addToast(`Neighbor response recorded: ${response.replace("_", " ")}`, "success");
    }

    if (isOffline) {
      registerOfflineMutation("ADD_NOTIFICATION_RESPONSE", { notifId, response, notes }, `Recorded neighbor response: ${response} for notification ${notifId}`);
    }
  };

  // Disputes Actions
  const handleAddDispute = (newDispute: LandDispute) => {
    setDisputes((prev) => [newDispute, ...prev]);
    setParcels((prev) =>
      prev.map((p) => {
        if (p.upi === newDispute.upi) {
          const updatedP = { ...p, status: ParcelStatus.DISPUTED };
          if (socket && isCollabConnected) {
            socket.emit("edit-parcel", { parcel: updatedP });
          }
          return updatedP;
        }
        return p;
      })
    );
    if (socket && isCollabConnected) {
      socket.emit("add-dispute", { dispute: newDispute });
    }
    addToast(`Registered lawsuit docket for UPI ${newDispute.upi}`, "warning");

    if (isOffline) {
      registerOfflineMutation("ADD_DISPUTE", { newDispute }, `Filed lawsuit dispute docket on UPI ${newDispute.upi}`);
    }
  };

  const handleResolveDispute = (disputeId: string, resolutionDetails: string) => {
    setDisputes((prev) =>
      prev.map((d) => (d.id === disputeId ? { ...d, status: "Resolved", resolutionDetails } : d))
    );
    
    // Return parcel status back to approved!
    const targetDispute = disputes.find(d => d.id === disputeId);
    if (targetDispute) {
      setParcels((prev) =>
        prev.map((p) => {
          if (p.upi === targetDispute.upi) {
            const updatedP = {
              ...p,
              status: ParcelStatus.APPROVED,
              history: [
                ...p.history,
                {
                  date: new Date().toISOString().split("T")[0],
                  type: "Dispute Resolved" as const,
                  details: `Land Dispute settled. Decree recorded: "${resolutionDetails}"`,
                  actor: targetDispute.assignedOfficer
                }
              ]
            };
            if (socket && isCollabConnected) {
              socket.emit("edit-parcel", { parcel: updatedP });
            }
            return updatedP;
          }
          return p;
        })
      );
      if (socket && isCollabConnected) {
        socket.emit("update-dispute", {
          disputeId,
          status: "Resolved",
          resolutionDetails,
          assignedOfficer: loggedInUser?.name ?? "Unknown"
        });
      }
    }
    addToast(`Case file resolved. Decree recorded successfully!`, "success");

    if (isOffline) {
      registerOfflineMutation("RESOLVE_DISPUTE", { disputeId, resolutionDetails }, `Resolved lawsuit dispute ${disputeId}`);
    }
  };

  const handleScheduleHearing = (disputeId: string, date: string, officer: string) => {
    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId ? { ...d, status: "Hearing Scheduled", hearingDate: date, assignedOfficer: officer } : d
      )
    );
    if (socket && isCollabConnected) {
      socket.emit("update-dispute", {
        disputeId,
        status: "Hearing Scheduled",
        hearingDate: date,
        assignedOfficer: officer
      });
    }
    addToast(`Tribunal hearing scheduled on ${date} with arbiter ${officer}`, "info");

    if (isOffline) {
      registerOfflineMutation("SCHEDULE_HEARING", { disputeId, date, officer }, `Scheduled dispute tribunal hearing for ${disputeId}`);
    }
  };

  // Complete drawing new parcel in GIS
  const handleDrawComplete = (newPolygon: [number, number][], area: number) => {
    const newId = `p-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUpi = `1/02/11/04/${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Estimate center
    const xs = newPolygon.map(pt => pt[0]);
    const ys = newPolygon.map(pt => pt[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const center: [number, number] = [Math.round((minX + maxX)/2), Math.round((minY + maxY)/2)];
 
    const newParcel: LandParcel = {
      id: newId,
      upi: newUpi,
      polygon: newPolygon,
      center,
      area,
      landUse: LandUse.RESIDENTIAL,
      status: ParcelStatus.APPROVED,
      ownerName: "First Adjudication Applicant",
      ownerId: "1199080034451009",
      ownerType: OwnerType.INDIVIDUAL,
      district: "Gasabo",
      sector: "Kimihurura",
      cell: "Rugando",
      village: "Gasasa",
      marketValue: Math.round(area * 3200),
      annualTax: Math.round(area * 10),
      taxPaid: true,
      history: [
        {
          date: new Date().toISOString().split("T")[0],
          type: "Registration",
          details: "First adjudication and coordinate-based polygon mapping on public platform.",
          actor: "Public Portal Self-Registration"
        }
      ]
    };

    setParcels((prev) => {
      const updated = [...prev, newParcel];
      if (socket && isCollabConnected) {
        socket.emit("edit-parcel", { parcel: newParcel });
      }
      return updated;
    });
    setSelectedParcel(newParcel);
    addToast(`Adjudicated New Parcel polygon successfully: UPI ${newUpi}!`, "success");

    if (isOffline) {
      registerOfflineMutation("DRAW_COMPLETE", { newPolygon, area }, `Mapped boundary polygon for new UPI ${newUpi}`);
    }
  };

  // Update documents inside a land parcel
  const handleUpdateParcelDocuments = (parcelId: string, updatedDocs: ParcelDocument[]) => {
    setParcels((prev) =>
      prev.map((p) => {
        if (p.id === parcelId) {
          const updatedP = { ...p, documents: updatedDocs };
          if (socket && isCollabConnected) {
            socket.emit("edit-parcel", { parcel: updatedP });
          }
          return updatedP;
        }
        return p;
      })
    );
    // Also update selectedParcel if it's the one currently selected
    setSelectedParcel((prev) => {
      if (prev && prev.id === parcelId) {
        return { ...prev, documents: updatedDocs };
      }
      return prev;
    });
    addToast(`Document vault updated and sealed!`, "success");

    if (isOffline) {
      registerOfflineMutation("UPDATE_PARCEL_DOCS", { parcelId, updatedDocs }, `Uploaded/updated document registry for parcel ${parcelId}`);
    }
  };

  // --- AUTH HANDLERS ---
  const handleLogin = (user: AuthUser) => {
    setLoggedInUser(user);
    setCurrentRole(user.role);
    addToast(`Welcome, ${user.name}! Authenticated as ${user.role}.`, "success");
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setCurrentRole(UserRole.CITIZEN);
    setActiveCopilotAnalysis("");
    addToast("Signed out successfully.", "info");
  };

  // Show login screen if not authenticated
  if (!loggedInUser) {
    return <Login onLogin={handleLogin} />;
  }

  // --- GEMINI CO-PILOT ANALYSIS (real AI, falls back to mock) ---
  const triggerCopilotAnalysis = async () => {
    if (!selectedParcel) return;
    setIsAnalyzing(true);
    setActiveCopilotAnalysis("");

    try {
      const analysisText = await analyzeParcel(selectedParcel, geminiApiKey);
      setActiveCopilotAnalysis(analysisText);
      addToast(geminiApiKey ? "Gemini spatial analysis complete!" : "Offline analysis complete (no API key — using fallback engine)", "success");
    } catch (err: any) {
      setActiveCopilotAnalysis(`⚠️ Analysis failed: ${err?.message || "Unknown error"}`);
      addToast("Copilot analysis failed", "warning");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-500 selection:text-white">
      
      {/* 1. TOP GLOBAL NAVIGATION & LOGO BAR */}
      <header id="lais_nav_header" className="bg-slate-900 border-b border-slate-950 px-4 md:px-6 py-2 md:py-3 flex flex-wrap items-center justify-between gap-3 md:gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-slate-50 font-black text-sm shadow-md">
            U
          </div>
          <div>
            <h1 className="font-sans font-black text-slate-100 text-xs tracking-tight flex items-center gap-1.5">
              UBUTAKA SMART LAND
            </h1>
            <span className="hidden sm:block text-[8.5px] font-mono font-bold text-slate-400 tracking-widest uppercase">
              Rwanda LAIS Unified Platform
            </span>
          </div>
        </div>

        {/* Global Stats bar */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-6 text-[9px] xl:text-[10px] font-mono text-slate-400">
          <div>
            <span className="text-slate-500 font-sans font-semibold text-[8px] block uppercase tracking-wider">Planimetric Database</span>
            <strong className="text-slate-200">{parcels.length} Active UPIs</strong>
          </div>
          <div>
            <span className="text-slate-500 font-sans font-semibold text-[8px] block uppercase tracking-wider">Surveyor Beacons</span>
            <strong className="text-blue-400">RTK Coordinated CORS</strong>
          </div>
          <div>
            <span className="text-slate-500 font-sans font-semibold text-[8px] block uppercase tracking-wider">Active Disputes</span>
            <strong className="text-rose-400">{disputes.filter(d => d.status !== "Resolved").length} Cases</strong>
          </div>
        </div>

        {/* Network & Intermittent Connectivity Controller */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOffline ? "bg-amber-400" : "bg-emerald-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOffline ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            </span>
            <div className="text-left leading-none">
              <span className="text-[7.5px] font-mono font-bold text-slate-500 block uppercase">CONNECTIVITY</span>
              <span className={`text-[9.5px] font-black uppercase tracking-tight ${isOffline ? "text-amber-400" : "text-emerald-400"}`}>
                {isOffline ? "Offline Mode" : "Online Active"}
              </span>
            </div>
          </div>
          
          <button
            id="toggle_offline_sim"
            onClick={() => {
              setIsManualOffline(!isManualOffline);
              addToast(
                !isManualOffline 
                  ? "Simulated Offline: Switched to Local IndexedDB read-only mode." 
                  : "Online restored: Reconnecting to active registry servers.",
                !isManualOffline ? "warning" : "success"
              );
            }}
            className={`px-2 py-1 rounded text-[8.5px] font-mono font-black uppercase cursor-pointer border tracking-tight transition-all duration-150 ${
              isManualOffline
                ? "bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
            }`}
          >
            {isManualOffline ? "Reconnect" : "Go Offline"}
          </button>
        </div>

        {/* User Identity & Logout */}
        <div className="flex items-center gap-2 md:gap-3 bg-slate-950 border border-slate-800/80 rounded-lg px-2 md:px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {loggedInUser.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="leading-tight hidden sm:block">
              <span className="text-slate-200 font-bold text-[11px] block">{loggedInUser.name}</span>
              <span className={`font-mono text-[8.5px] font-bold uppercase tracking-wider ${
                currentRole === UserRole.CITIZEN ? "text-emerald-400" :
                currentRole === UserRole.SURVEYOR || currentRole === UserRole.DRONE_MISSION ? "text-blue-400" :
                currentRole === UserRole.LAND_OFFICER ? "text-rose-400" :
                currentRole === UserRole.NOTARY ? "text-amber-400" :
                currentRole === UserRole.REGISTRAR ? "text-blue-400" : "text-violet-400"
              }`}>
                {currentRole.replace("Licensed ", "").replace("District/National ", "")}
              </span>
            </div>
          </div>
          <button
            id="btn_logout"
            onClick={handleLogout}
            className="px-2 md:px-2.5 py-1 bg-slate-800 hover:bg-rose-700 border border-slate-700 hover:border-rose-600 text-slate-300 hover:text-white rounded-md font-bold text-[9px] md:text-[10px] transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Offline Status Warning Banner */}
      {isOffline && (
        <div id="offline_alert_banner" className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs flex flex-col gap-2 animate-fadeIn shrink-0 shadow-lg border-b border-amber-800">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
            <div className="flex items-start md:items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-100 animate-pulse shrink-0 mt-0.5 md:mt-0" />
              <span className="leading-relaxed">
                <strong>Intermittent Connectivity Active:</strong> Running on cached local IndexedDB. All mutations are captured in a local Background Sync Queue and will replay when connection is restored.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              {pendingSyncQueue.length > 0 && (
                <span className="bg-amber-900/80 text-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-tight animate-pulse shrink-0">
                  {pendingSyncQueue.length} Pending Sync
                </span>
              )}
              <button 
                id="restore_connection_btn"
                onClick={() => {
                  setIsManualOffline(false);
                  addToast("Network connection manually restored.", "success");
                }}
                className="px-3 py-1 bg-amber-850 hover:bg-amber-900 border border-amber-700/60 rounded text-[9px] font-mono font-black uppercase tracking-wider transition-all duration-150 shrink-0 cursor-pointer"
              >
                Restore Live
              </button>
            </div>
          </div>

          {/* Show queue list if any */}
          {pendingSyncQueue.length > 0 && (
            <div className="bg-amber-950/40 rounded border border-amber-500/30 p-2 max-h-36 overflow-y-auto">
              <div className="text-[9.5px] font-mono font-bold text-amber-200 uppercase mb-1 tracking-wider">
                Pending Background Sync Queue ({pendingSyncQueue.length})
              </div>
              <div className="grid grid-cols-1 gap-1">
                {pendingSyncQueue.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-amber-950/50 px-2 py-1 rounded text-[10px] font-mono border border-amber-600/10">
                    <div className="flex items-center gap-2 text-amber-100 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      <strong className="text-amber-300 uppercase shrink-0">[{m.type.replace("_", " ")}]</strong>
                      <span className="truncate text-slate-300">{m.description}</span>
                    </div>
                    <span className="text-[8.5px] text-amber-400/70 shrink-0 font-light">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Syncing Progress Banner */}
      {isSyncing && (
        <div id="syncing_progress_banner" className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-2.5 text-xs flex items-center justify-between gap-4 animate-fadeIn shrink-0 shadow-lg border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-emerald-100 animate-spin shrink-0" />
            <span className="leading-relaxed">
              <strong>Network Connectivity Detected:</strong> Replaying and committing {pendingSyncQueue.length} offline-captured transactions to the land registry authority ledger servers...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping"></span>
            <span className="text-[10px] font-mono font-bold text-emerald-200 uppercase tracking-wider">Synchronizing...</span>
          </div>
        </div>
      )}

      {/* 2. MAIN COCKPIT SECTION: GIS Map Left, Dynamic Role Panel Right */}
      {currentRole === UserRole.DRONE_MISSION ? (
        <main className="flex-1 p-4 bg-[#050b14] overflow-hidden flex flex-col min-h-0">
          <DroneMissionControl
            parcels={parcels}
            onSelectParcel={handleSelectParcel}
            selectedParcel={selectedParcel}
          />
        </main>
      ) : (
        <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 md:p-6 bg-slate-50 overflow-hidden">
        
        {/* Left Active Workspace Portal Panel (4 Cols) */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col h-full space-y-4 overflow-hidden">
          
          {/* Active Portal Views switcher based on currentRole state */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {currentRole === UserRole.CITIZEN && (
              <CitizenPortal
                currentCitizen={{
                  name: loggedInUser.name,
                  nationalId: loggedInUser.nationalId,
                  phone: loggedInUser.phone,
                  email: loggedInUser.email,
                  province: loggedInUser.district,
                  district: loggedInUser.district,
                  sector: loggedInUser.sector
                }}
                parcels={parcels}
                applications={applications}
                onAddApplication={handleAddApplication}
                onPayApplication={handlePayApplication}
                onSelectParcel={handleSelectParcel}
                onPayParcelTax={handlePayParcelTax}
              />
            )}

            {currentRole === UserRole.SURVEYOR && (
              <SurveyorToolkit
                surveyors={{ id: "sv-101", name: loggedInUser.name }}
                assignments={assignments}
                notifications={notifications}
                parcels={parcels}
                onConfirmBeacon={onConfirmBeacon}
                onSetGeofenceRadius={onSetGeofenceRadius}
                onAddVoiceNote={onAddVoiceNote}
                onUpdateAssignmentStatus={handleUpdateAssignmentStatus}
                onSelectParcel={handleSelectParcel}
                onAddNotificationResponse={onAddNotificationResponse}
                onGPSUpdate={handleGPSUpdate}
              />
            )}

            {currentRole === UserRole.LAND_OFFICER && (
              <DisputeCenter
                disputes={disputes}
                parcels={parcels}
                onAddDispute={handleAddDispute}
                onResolveDispute={handleResolveDispute}
                onScheduleHearing={handleScheduleHearing}
                onSelectParcel={handleSelectParcel}
              />
            )}

            {currentRole === UserRole.NOTARY && (
              <NotaryPortal
                applications={applications}
                parcels={parcels}
                onVerifyIdentity={handleNotaryVerifyIdentity}
                onSignAndForward={handleNotarySignAndForward}
                onReject={handleNotaryReject}
                onSelectParcel={handleSelectParcel}
              />
            )}

            {currentRole === UserRole.REGISTRAR && (
              <RegistrarPortal
                applications={applications}
                parcels={parcels}
                onRegistrarApprove={handleRegistrarApprove}
                onSendBackToNotary={handleSendBackToNotary}
                onSelectParcel={handleSelectParcel}
              />
            )}

            {currentRole === UserRole.ADMIN && (
              <AnalyticsDashboard
                parcels={parcels}
                assignments={assignments}
                disputes={disputes}
                iotSensors={iotSensors}
                droneMissions={droneMissions}
              />
            )}
          </div>

          {/* GEO-FENCE ALERT MONITOR */}
          {(currentRole === UserRole.SURVEYOR || currentRole === UserRole.ADMIN) && (
            <GeoFenceAlertPanel
              events={geoFenceEvents}
              onAcknowledge={handleAcknowledgeGeoFence}
              onClearAll={handleClearGeoFenceEvents}
              onSelectPosition={handleGeoFencePositionSelect}
              activeAssignment={assignments.find(a => a.status === "Active") || null}
            />
          )}

          {/* SECURE LEGAL DOCUMENT REGISTRY & VERSION LEDGER */}
          <ParcelDocumentRegistry
            selectedParcel={selectedParcel}
            onUpdateParcelDocuments={handleUpdateParcelDocuments}
            currentRole={currentRole}
            currentUsername={customUsername || loggedInUser.name}
          />

          {/* DYNAMIC CO-PILOT CARD (ACCESSIBLE TO ALL ROLES) */}
          <div id="gemini_copilot_panel" className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5 shadow-sm shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-500 animate-pulse" />
                <h4 className="font-sans font-bold text-slate-800 text-xs flex items-center gap-1">
                  Gemini LAIS Copilot Assistant
                </h4>
              </div>
              <button
                id="btn_trigger_copilot"
                onClick={triggerCopilotAnalysis}
                disabled={!selectedParcel || isAnalyzing}
                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-slate-50 text-[10px] font-bold rounded transition flex items-center gap-1 cursor-pointer"
              >
                {isAnalyzing ? "Querying LLM..." : "Analyze Selected UPI"}
              </button>
            </div>

            {/* Gemini API Key Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => handleSetGeminiApiKey(e.target.value)}
                placeholder="Enter Google Gemini API key (optional — uses offline analysis otherwise)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[9px] font-mono outline-none focus:border-blue-400 text-slate-700"
              />
              {geminiApiKey && (
                <button
                  onClick={() => handleSetGeminiApiKey("")}
                  className="text-[9px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer shrink-0"
                  title="Clear API key"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedParcel ? (
              <div className="text-[10px] space-y-1.5 font-sans">
                {activeCopilotAnalysis ? (
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-emerald-400 font-mono leading-normal whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                    {activeCopilotAnalysis}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">
                    Ready to audit UPI {selectedParcel.upi}. Click 'Analyze Selected UPI' to run spatial constraints verification, environmental wetland risk queries, property tax liabilities checks, and draft sales deeds.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">
                Please click a parcel polygon directly on the map to initialize the Gemini Copilot auditing ledger.
              </p>
            )}
          </div>

        </div>

        {/* Right Interactive GIS Map Pane (8 Cols) */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col h-full min-h-[300px] md:min-h-[250px]">
          <div className="flex-1 relative">
            <GisMap
              parcels={parcels}
              onSelectParcel={handleSelectParcel}
              selectedParcel={selectedParcel}
              activeSurveyParcelId={assignments.find(a => a.status === "Active")?.parcelId}
              activeGeofenceRadius={assignments.find(a => a.status === "Active")?.geofenceRadius}
              iotSensors={iotSensors}
              isDrawingMode={isDrawingMode}
              setIsDrawingMode={setIsDrawingMode}
              onDrawComplete={handleDrawComplete}
              onCursorMove={handleCursorMove}
              cursors={cursors}
              surveyorGps={surveyorGps}
              presence={presence}
            />
          </div>
          
          {/* Quick Guide explaining coordinate system */}
          <div className="mt-2.5 bg-white p-2 md:p-3 rounded-lg border border-slate-200 flex items-start gap-2 text-xs text-slate-600 shadow-sm">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-sans font-medium text-slate-600">
                <strong className="text-slate-800">Coordinate-Based Adjudication Philosophy:</strong> Click any parcel UPI directly on the vector map overlay. The active panel on the right will instantly synchronise. Drag rulers to measure distances or use "Draw Polygon" to simulate a surveyor's boundary coordinates adjudication.
              </p>
            </div>
          </div>
        </div>
      </main>
      )}

      {/* KEYBOARD SHORTCUTS HELP OVERLAY */}
      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}

      {/* 3. FLOATING DISPATCH LOGS / TOAST ALERTS OVERLAY */}
      <div id="floating_alerts_container" className="fixed bottom-4 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] md:max-w-sm w-full">
        {liveToasts.map((t) => (
          <div
            key={t.id}
            className={`p-3 rounded-lg shadow-xl border text-xs flex items-start gap-2.5 animate-in slide-in-from-bottom duration-300 font-sans ${
              t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
              t.type === "warning" ? "bg-rose-50 border-rose-200 text-rose-900" :
              "bg-white border-slate-200 text-slate-800"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : t.type === "warning" ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Compass className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 animate-spin-slow" />
            )}
            <div>
              <p className="font-semibold leading-snug">{t.msg}</p>
            </div>
          </div>
        ))}
      </div>

      {/* REAL-TIME COLLABORATION HUB WIDGET */}
      <div id="collab_hub_widget" className="fixed bottom-14 md:bottom-16 right-2 md:right-4 z-50 flex flex-col items-end">
        {isCollabExpanded ? (
          <div className="w-[calc(100vw-1rem)] md:w-80 max-h-[70vh] md:max-h-[24rem] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans text-xs mb-3 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <div>
                  <span className="font-bold block">Sector Collaboration Hub</span>
                  <span className="text-[9px] text-slate-400 font-mono">Room: Kigali Central Sector</span>
                </div>
              </div>
              <button
                onClick={() => setIsCollabExpanded(false)}
                className="text-slate-400 hover:text-white font-bold text-base cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Username Customize Bar */}
            <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1 shrink-0">
              <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider shrink-0">Identity:</span>
              <input
                id="collab_username_input"
                type="text"
                value={customUsername}
                onChange={(e) => handleUpdateNickname(e.target.value)}
                placeholder="Change Nickname"
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-sans font-bold text-slate-800 flex-1 outline-none focus:border-blue-500"
              />
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              <button
                onClick={() => setActiveCollabTab("chat")}
                className={`flex-1 py-2 font-bold text-center border-b-2 transition ${
                  activeCollabTab === "chat" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                💬 Sector Chat ({chatMessages.length})
              </button>
              <button
                onClick={() => setActiveCollabTab("presence")}
                className={`flex-1 py-2 font-bold text-center border-b-2 transition ${
                  activeCollabTab === "presence" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                👥 Active Presence ({presence.length})
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-slate-50/20">
              {activeCollabTab === "chat" ? (
                <div className="space-y-2.5 h-full flex flex-col justify-between">
                  {/* Message Log */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[170px]" id="chat_messages_log">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 italic text-[10.5px]">
                        No messages in this session yet. Type below to start real-time civil chat!
                      </div>
                    ) : (
                      chatMessages.map((msg: any, idx: number) => {
                        const isMe = msg.senderName === customUsername;
                        const roleColor = msg.senderRole === "Citizen" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : msg.senderRole === "Licensed Surveyor" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-rose-50 text-rose-700 border-rose-200";
                        return (
                          <div key={idx} className={`space-y-0.5 ${isMe ? "text-right" : "text-left"}`}>
                            <div className="flex items-center gap-1.5 justify-start text-[9.5px]">
                              <span className="font-bold text-slate-700">{msg.senderName}</span>
                              <span className={`px-1 rounded-sm border text-[7.5px] font-black uppercase tracking-wider ${roleColor}`}>{msg.senderRole}</span>
                              <span className="text-[8.5px] text-slate-400 font-mono">{msg.timestamp}</span>
                            </div>
                            <p className={`p-2 rounded-lg text-[11px] inline-block max-w-[85%] leading-normal text-left ${
                              isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-850 border border-slate-200 rounded-tl-none shadow-xs"
                            }`}>
                              {msg.text}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (chatInput.trim()) {
                        handleSendChatMessage(chatInput);
                        setChatInput("");
                      }
                    }}
                    className="flex gap-1.5 border-t border-slate-200 pt-2 bg-white mt-1 shrink-0"
                  >
                    <input
                      id="collab_chat_input"
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a public message..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] outline-none focus:bg-white focus:border-blue-500"
                    />
                    <button
                      id="btn_send_chat"
                      type="submit"
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-[11.5px] transition cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-2 h-full overflow-y-auto pr-1">
                  <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Who's Online Now:</div>
                  {presence.map((user: any, idx: number) => {
                    const isMe = user.socketId === mySessionId;
                    const roleColor = user.role === "Citizen" ? "bg-emerald-100 text-emerald-800" : user.role === "Licensed Surveyor" ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-800";
                    return (
                      <div key={idx} className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-1.5 shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <div>
                            <span className="font-sans font-bold text-slate-800 text-[11.5px] flex items-center gap-1">
                              {user.name} {isMe && <span className="text-[8.5px] text-blue-500 font-bold">(You)</span>}
                            </span>
                            <span className={`px-1 py-0.2 rounded-sm text-[7.5px] font-black uppercase tracking-wider border ${roleColor} mt-0.5 inline-block`}>
                              {user.role}
                            </span>
                          </div>
                        </div>
                        {user.role === "Licensed Surveyor" && surveyorGps[user.socketId] && (
                          <div className="text-right">
                            <span className="px-1 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[7px] rounded font-extrabold uppercase tracking-widest block animate-pulse">
                              📡 GPS Live
                            </span>
                            <span className="font-mono text-[7px] text-slate-400 mt-0.5 block">
                              {surveyorGps[user.socketId].lat.toFixed(5)}, {surveyorGps[user.socketId].lon.toFixed(5)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            id="btn_expand_collab_hub"
            onClick={() => setIsCollabExpanded(true)}
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-3.5 py-2 bg-slate-900 text-white rounded-full font-bold shadow-2xl hover:bg-slate-800 cursor-pointer text-[10px] md:text-xs animate-pulse hover:scale-105 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
            <span>👥</span> <span className="hidden md:inline">Real-time Sector </span>Collab Hub ({presence.length})
          </button>
        )}
      </div>

      {/* 4. FOOTER CREDITS */}
      <footer className="bg-white border-t border-slate-200 px-3 md:px-4 py-2 text-center text-[8px] md:text-[9px] font-mono text-slate-500 shadow-inner shrink-0">
        Ubutaka Smart Land Registry System | Certified by RLMUA. Integrated with Irembo APIs.
      </footer>
    </div>
  );
}
