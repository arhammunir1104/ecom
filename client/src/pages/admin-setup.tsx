import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateUserRole } from "@/lib/firebaseService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function AdminSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uidToPromote, setUidToPromote] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const promoteUserToAdmin = async () => {
    if (!uidToPromote.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Firebase UID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await updateUserRole(uidToPromote, "admin");
      toast({
        title: "Success",
        description: `User with UID ${uidToPromote} has been promoted to admin`,
      });
      setUidToPromote("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to promote user to admin",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>
            Promote a user to admin by entering their Firebase UID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {user && (
              <div className="bg-muted p-3 rounded">
                <p className="text-sm font-medium">Your User Information:</p>
                <p className="text-xs">UID: {user.uid}</p>
                <p className="text-xs">Email: {user.email}</p>
                <p className="text-xs">Role: {user.role}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="uid" className="text-sm font-medium">
                Firebase UID to promote
              </label>
              <Input
                id="uid"
                value={uidToPromote}
                onChange={(e) => setUidToPromote(e.target.value)}
                placeholder="Enter Firebase UID"
              />
            </div>

            <Button
              onClick={promoteUserToAdmin}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Promote to Admin"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}