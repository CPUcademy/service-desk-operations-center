import { useEffect, useState } from "react";
import MachineCard from "./MachineCard";
import type { Machine } from "../types/Machine";
import { API_URL } from "../config";

function InnerDashboard(){
    const [machines, setMachines] = useState<Machine[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
     useEffect(() => {
        let active = true;
        let timeoutId: number;

        async function fetchMachines() {
            try {
                const response = await fetch(
                    `${API_URL}/api/v1/machines`,
                    {
                        method: 'GET',
                        credentials: 'include'
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch machines');
                }

                const data: Machine[] = await response.json();

                if (active) {
                    setMachines(data);
                    setError(null);
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            } finally {
                if (active) {
                    setLoading(false);
                    timeoutId = window.setTimeout(() => void fetchMachines(), 5000);
                }
            }
        }

        void fetchMachines();
        return () => {
            active = false;
            window.clearTimeout(timeoutId);
        };
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error && machines.length === 0) return <p>{error}</p>;

    return(
        <div>
            {error && <p role="alert">{error}</p>}
            {machines.map(m => <MachineCard key={m.id} machine={m}/>)}
        </div>
    );
}
export default InnerDashboard;
