import { useEffect, useState } from "react";
import MachineCard from "./MachineCard";
import type { Machine } from "../types/Machine";
import { API_URL } from "../config";

function InnerDashboard(){
    const [machines, setMachines] = useState<Machine[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
     useEffect(() => {
        async function fetchUsers() {
            try {
                const response = await fetch(
                    `${API_URL}/api/v1/machines`,
                    {
                        method: 'GET',
                        credentials: 'include'
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch users');
                }

                const data: Machine[] = await response.json();

                setMachines(data);
                console.log(machines);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'Unknown error'
                );
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>{error}</p>;

    console.log("bajo");
    return(
        <div>
            {machines.map(m => <MachineCard key={m.id} machine={m}/>)}
        </div>
    );
}
export default InnerDashboard;
