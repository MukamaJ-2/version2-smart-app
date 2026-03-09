import { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, Html, Float } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { aiService } from "@/lib/ai/ai-service";
import * as THREE from "three";

interface ReceiptItem {
  description: string;
  amount: number;
  category: string;
}

interface ReceiptOrbProps {
  startPos: [number, number, number];
  endPos: [number, number, number];
  color: string;
  onComplete: () => void;
  delay?: number;
}

function ReceiptOrb({ startPos, endPos, color, onComplete, delay = 0 }: ReceiptOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTime = useRef(0);
  const [started, setStarted] = useState(false);

  // Animation duration in seconds
  const DURATION = 1.5;

  useFrame((state) => {
    if (!meshRef.current) return;

    if (!started) {
      if (startTime.current === 0) {
        startTime.current = state.clock.elapsedTime + delay;
      }
      if (state.clock.elapsedTime >= startTime.current) {
        setStarted(true);
      } else {
        return; // wait for delay
      }
    }

    const elapsed = state.clock.elapsedTime - startTime.current;
    const progress = Math.min(elapsed / DURATION, 1);

    // Easing function (ease out cubic)
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    // Interpolate position
    const startVec = new THREE.Vector3(...startPos);
    const endVec = new THREE.Vector3(...endPos);
    meshRef.current.position.lerpVectors(startVec, endVec, easeProgress);

    // Slight arc to the path
    meshRef.current.position.y += Math.sin(progress * Math.PI) * 1.5;

    // Scale down as it gets closer
    const scale = 1 - progress * 0.5;
    meshRef.current.scale.setScalar(scale);

    if (progress >= 1) {
      onComplete();
    }
  });

  if (!started) return null;

  return (
    <Sphere ref={meshRef} args={[0.2, 16, 16]} position={startPos}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        transparent
        opacity={0.8}
      />
    </Sphere>
  );
}

interface NexusNodeProps {
  position: [number, number, number];
  color: string;
  label: string;
  value: string;
  size?: number;
  onClick?: () => void;
  link?: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
}

interface FluxPod {
  id: string;
  allocated: number;
  spent: number;
}

interface Goal {
  id: string;
  name: string;
}

function NexusNode({ position, color, label, value, size = 0.5, onClick, link }: NexusNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const targetSizeRef = useRef(size);

  useEffect(() => {
    targetSizeRef.current = size;
  }, [size]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      // Smoothly animate to target size
      meshRef.current.scale.lerp(new THREE.Vector3(targetSizeRef.current, targetSizeRef.current, targetSizeRef.current), delta * 2);
    }
    if (glowRef.current) {
      const baseScale = targetSizeRef.current * 1.5;
      const pulsingScale = baseScale + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.lerp(new THREE.Vector3(pulsingScale, pulsingScale, pulsingScale), delta * 2);
    }
  });

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={position} onClick={handleClick}>
        {/* Outer glow */}
        <Sphere ref={glowRef} args={[1, 32, 32]}>
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </Sphere>

        {/* Main sphere */}
        <Sphere ref={meshRef} args={[1, 32, 32]}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            roughness={0.3}
            metalness={0.8}
          />
        </Sphere>

        {/* Label - Make it clickable */}
        <Html position={[0, size + 0.5, 0]} center distanceFactor={8}>
          <div
            className={cn("text-center cursor-pointer hover:opacity-80 transition-opacity", link && "pointer-events-auto")}
            onClick={link ? handleClick : undefined}
          >
            <p className="font-display text-xs text-foreground/80 whitespace-nowrap">{label}</p>
            <p className="font-mono text-sm font-bold text-primary text-glow-sm whitespace-nowrap">{value}</p>
          </div>
        </Html>
      </group>
    </Float>
  );
}

function OrbitRing({ radius, color, speed = 1, opacity = 0.3 }: { radius: number; color: string; speed?: number; opacity?: number }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * speed * 0.1;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius + 0.02, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

function DataFlowLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const lineRef = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
    geo.setFromPoints(points);
    return geo;
  }, [start, end]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
    });
  }, [color]);

  useFrame((state) => {
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  return <primitive object={new THREE.Line(geometry, material)} ref={lineRef} />;
}

function CentralCore() {
  const coreRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += 0.01;
      coreRef.current.rotation.z += 0.005;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= 0.015;
      const scale = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      innerRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Outer icosahedron */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner sphere */}
      <Sphere ref={innerRef} args={[0.3, 32, 32]}>
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={1}
          roughness={0}
          metalness={1}
        />
      </Sphere>

      {/* Core glow */}
      <Sphere args={[0.8, 32, 32]}>
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.05} />
      </Sphere>
    </group>
  );
}

function Scene({
  nodes,
  onNodeClick,
}: {
  nodes: NexusNodeProps[];
  onNodeClick?: (link: string) => void;
}) {

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00d4ff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />

      {/* Central Core */}
      <CentralCore />

      {/* Orbit Rings */}
      <OrbitRing radius={2} color="#00d4ff" speed={0.5} opacity={0.2} />
      <OrbitRing radius={3.5} color="#a855f7" speed={-0.3} opacity={0.15} />
      <OrbitRing radius={5} color="#f59e0b" speed={0.2} opacity={0.1} />

      {/* Nodes */}
      {nodes.map((node, index) => (
        <NexusNode
          key={index}
          {...node}
          link={node.link}
          onClick={node.link && onNodeClick ? () => onNodeClick(node.link!) : undefined}
        />
      ))}

      {/* Data Flow Lines */}
      {nodes[0] && <DataFlowLine start={[0, 0, 0]} end={nodes[0].position} color="#22c55e" />}
      {nodes[1] && <DataFlowLine start={[0, 0, 0]} end={nodes[1].position} color="#00d4ff" />}
      {nodes[2] && <DataFlowLine start={[0, 0, 0]} end={nodes[2].position} color="#f59e0b" />}
      {nodes[3] && <DataFlowLine start={[0, 0, 0]} end={nodes[3].position} color="#a855f7" />}
      {nodes[4] && <DataFlowLine start={nodes[0].position} end={nodes[4].position} color="#ef4444" />}

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={12}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export default function FinancialNexus({
  simulatedMonths = 0,
  receiptData,
  onReceiptAnimationComplete
}: {
  simulatedMonths?: number,
  receiptData?: { items: ReceiptItem[] } | null,
  onReceiptAnimationComplete?: () => void
}) {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fluxPods, setFluxPods] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeOrbs, setActiveOrbs] = useState<Array<{ id: string; item: ReceiptItem; startPos: [number, number, number]; endPos: [number, number, number]; color: string; delay: number }>>([]);

  // Helper to get color by category for the orbs mapping to flux pods
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Food: "#22c55e",
      Tech: "#00d4ff",
      Shopping: "#f59e0b",
      Clothing: "#a855f7",
    };
    return colors[category] || "#ef4444";
  };

  const handleNodeClick = (link: string) => {
    navigate(link);
  };

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) return;
      setUserId(userData.user.id);
      const { data: txData } = await supabase
        .from("transactions")
        .select("id,amount,type")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setTransactions((txData ?? []) as Transaction[]);
      const { data: podData } = await supabase
        .from("flux_pods")
        .select("*")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setFluxPods((podData ?? []) as any[]);
      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setGoals((goalData ?? []) as any[]);
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const txChannel = supabase
      .channel("nexus-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTransactions((prev) => [...prev, payload.new as Transaction]);
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Transaction;
            setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setTransactions((prev) => prev.filter((tx) => tx.id !== removedId));
          }
        }
      )
      .subscribe();

    const podChannel = supabase
      .channel("nexus-pods")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flux_pods", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setFluxPods((prev) => [...prev, payload.new as FluxPod]);
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as FluxPod;
            setFluxPods((prev) => prev.map((pod) => (pod.id === updated.id ? updated : pod)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setFluxPods((prev) => prev.filter((pod) => pod.id !== removedId));
          }
        }
      )
      .subscribe();

    const goalsChannel = supabase
      .channel("nexus-goals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setGoals((prev) => [...prev, payload.new as Goal]);
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Goal;
            setGoals((prev) => prev.map((goal) => (goal.id === updated.id ? updated : goal)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setGoals((prev) => prev.filter((goal) => goal.id !== removedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(podChannel);
      supabase.removeChannel(goalsChannel);
    };
  }, [userId]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }).format(value);

  const nodes = useMemo(() => {
    const income = transactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = transactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
    const podsAllocated = fluxPods.reduce((sum, pod) => sum + pod.allocated, 0);
    const netWorth = income - expenses;

    // Default sizes
    let netWorthSize = 0.8;
    let expensesSize = 0.5;
    let goalsSize = 0.6;
    let podsSize = 0.5;

    let displayNetWorth = netWorth;
    let displayExpenses = expenses;
    let goalsValue = goals.length ? `${goals.length} Active` : "No Goals";

    if (simulatedMonths > 0) {
      const simulatedState = aiService.simulateFutureState(
        simulatedMonths,
        fluxPods.map(p => ({ ...p, category: p.name || 'Unknown' })),
        goals.map(g => ({ ...g, targetAmount: g.target_amount || 0, currentAmount: g.current_amount || 0, monthlyContribution: g.monthly_contribution || 0 })),
        netWorth
      );

      displayNetWorth = simulatedState.projectedNetWorth;
      const totalProjectedPodSpend = simulatedState.projectedPods.reduce((a, b) => a + b.projectedSpent, 0);
      displayExpenses = expenses + (totalProjectedPodSpend * simulatedMonths);

      // Animate sizes based on changes
      netWorthSize = displayNetWorth > netWorth ? 1.0 : (displayNetWorth < netWorth ? 0.6 : 0.8);
      expensesSize = 0.5 + Math.min(simulatedMonths * 0.05, 0.4);

      const goalsProjected = simulatedState.projectedGoals.filter(g => g.projectedAmount >= g.targetAmount).length;
      if (goalsProjected > 0) {
        goalsValue = `${goalsProjected} Achieved in +${simulatedMonths}M`;
        goalsSize = 0.8; // Grow if we hit goals!
      } else {
        goalsSize = 0.6 + Math.min(simulatedMonths * 0.02, 0.2); // Slowly gro as we make progress
      }
    }

    return [
      { position: [3, 0.5, 0] as [number, number, number], color: "#22c55e", label: "Income", value: formatCurrency(income), link: "/transactions", size: 0.5 },
      { position: [-2.5, 1, 1.5] as [number, number, number], color: "#00d4ff", label: "Budget Ports", value: formatCurrency(podsAllocated), link: "/budget-ports", size: podsSize },
      { position: [-1, -1.5, 2.5] as [number, number, number], color: "#f59e0b", label: "Goals", value: goalsValue, link: "/goals", size: goalsSize },
      { position: [1.5, -1, -2.5] as [number, number, number], color: "#a855f7", label: "Net Worth", value: formatCurrency(displayNetWorth), link: "/reports", size: netWorthSize },
      { position: [-2, 0, -2] as [number, number, number], color: "#ef4444", label: "Expenses", value: formatCurrency(displayExpenses), link: "/transactions", size: expensesSize },
    ];
  }, [transactions, fluxPods, goals, simulatedMonths]);

  // Hook to watch receiptData map to flux pod nodes
  useEffect(() => {
    if (receiptData?.items && receiptData.items.length > 0) {
      // Find the budget pod node to act as the general direction if a specific pod isn't found
      const budgetNode = nodes.find(n => n.label === "Budget Ports");
      const defaultTarget = budgetNode?.position || [-2.5, 1, 1.5];

      const newOrbs = receiptData.items.map((item, index) => {
        // Here we could map item.category to specific sub-nodes, but for now they go into the general pods or expenses
        const targetNode = nodes.find(n => n.label === "Budget Ports") || nodes[1];

        return {
          id: `orb-${Date.now()}-${index}`,
          item,
          startPos: [0, 0, 0] as [number, number, number], // Shatter from center core
          endPos: targetNode.position as [number, number, number],
          color: getCategoryColor(item.category),
          delay: index * 0.3 // Stagger the animation
        };
      });

      setActiveOrbs(newOrbs);
    }
  }, [receiptData, nodes]);

  const handleOrbComplete = (orbId: string) => {
    setActiveOrbs(prev => {
      const remaining = prev.filter(o => o.id !== orbId);
      if (remaining.length === 0 && onReceiptAnimationComplete) {
        // Notify parent all animations finished
        onReceiptAnimationComplete();
      }
      return remaining;
    });
  };

  return (
    <div className="w-full h-full min-h-[500px] relative">
      <Canvas
        camera={{ position: [0, 3, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene nodes={nodes} onNodeClick={handleNodeClick} />

        {/* Render Active Scattering Orbs */}
        {activeOrbs.map(orb => (
          <ReceiptOrb
            key={orb.id}
            startPos={orb.startPos}
            endPos={orb.endPos}
            color={orb.color}
            delay={orb.delay}
            onComplete={() => handleOrbComplete(orb.id)}
          />
        ))}

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={4}
          maxDistance={12}
          autoRotate={activeOrbs.length === 0} // pause rotation during scatter
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* Overlay gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background via-transparent to-transparent" />
    </div>
  );
}
