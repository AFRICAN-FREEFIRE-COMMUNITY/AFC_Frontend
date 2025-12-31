// "use client";

// import { FullLoader } from "@/components/Loader";
// import { PageHeader } from "@/components/PageHeader";
// import { Input } from "@/components/ui/input";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { env } from "@/lib/env";
// import { formatDate } from "@/lib/utils";
// import axios from "axios";
// import { useEffect, useState } from "react";
// import { toast } from "sonner";

// const page = () => {
//   const [loading, setLoading] = useState(true);
//   const [recentActivities, setRecentActivities] = useState([]);

//   useEffect(() => {
//     const fetchUsers = async () => {
//       try {
//         const activities = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-admin-history/`
//         );

//         setRecentActivities(activities?.data?.admin_history);
//       } catch (error) {
//         toast.error("Oops! An error occurred");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchUsers();
//   }, []);

//   if (loading) {
//     return <FullLoader />;
//   }
//   return (
//     <div>
//       <PageHeader title="History" back />
//       <div className="mb-2">
//         <Input placeholder="Search history..." className="w-full" />
//       </div>
//       <Table>
//         <TableHeader>
//           <TableRow>
//             <TableHead>Admin User</TableHead>
//             <TableHead>Action</TableHead>
//             <TableHead className="text-right">Timestamp</TableHead>
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {recentActivities.map((activity: any) => (
//             <TableRow key={activity.id}>
//               <TableCell className="font-medium">
//                 {activity.admin_user}
//               </TableCell>
//               <TableCell className="max-w-sm overflow-x-hidden">
//                 {activity.description}
//               </TableCell>
//               <TableCell className="text-right text-muted-foreground">
//                 {formatDate(activity.timestamp)}
//               </TableCell>
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   );
// };

// export default page;

"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Search, Calendar as CalendarIcon } from "lucide-react";

const Page = () => {
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);

  // States for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const activities = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-admin-history/`
        );
        setRecentActivities(activities?.data?.admin_history || []);
      } catch (error) {
        toast.error("Oops! An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filtering Logic
  const filteredActivities = useMemo(() => {
    return recentActivities.filter((activity: any) => {
      // 1. Search filter (checks admin name or description)
      const matchesSearch =
        activity.admin_user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Date filter
      // Note: This assumes activity.timestamp is a valid date string
      const matchesDate = dateFilter
        ? activity.timestamp.startsWith(dateFilter)
        : true;

      return matchesSearch && matchesDate;
    });
  }, [recentActivities, searchQuery, dateFilter]);

  if (loading) {
    return <FullLoader />;
  }

  return (
    <div>
      <PageHeader title="History" back />

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by admin or action..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="relative w-full md:w-72">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            className="pl-10 w-full"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admin User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="text-right">Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredActivities.length > 0 ? (
            filteredActivities.map((activity: any) => (
              <TableRow key={activity.id}>
                <TableCell className="font-medium whitespace-nowrap">
                  {activity.admin_user}
                </TableCell>
                <TableCell className="max-w-sm overflow-x-hidden">
                  {activity.description}
                </TableCell>
                <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                  {formatDate(activity.timestamp)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-24 text-center text-muted-foreground italic"
              >
                No matching history found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default Page;
