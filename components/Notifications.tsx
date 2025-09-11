import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// This would typically come from an API or context
const mockNotifications: any = [
  // {
  //   id: 1,
  //   type: "team_invite",
  //   message: "You have been invited to join Team Alpha",
  //   timestamp: "2023-07-15T10:00:00Z",
  //   action: "/teams/1",
  //   teamId: "1",
  // },
  // {
  //   id: 2,
  //   type: "tournament_reminder",
  //   message: "Reminder: Summer Showdown starts in 2 days",
  //   timestamp: "2023-07-14T09:00:00Z",
  //   action: "/tournaments/1",
  // },
  // {
  //   id: 3,
  //   type: "friend_request",
  //   message: "John Doe sent you a friend request",
  //   timestamp: "2023-07-13T14:30:00Z",
  //   action: "/profile/friends",
  // },
];

export function Notifications() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const unreadCount = notifications.length;

  const handleNotificationClick = (notification: any) => {
    // Here you would typically mark the notification as read
    // and perform any necessary actions based on the notification type
    console.log(`Clicked notification ${notification.id}`);
    if (notification.action) {
      router.push(notification.action);
    }
    setNotifications(
      notifications.filter((n: any) => n.id !== notification.id)
    );
    setIsOpen(false);
  };

  const handleTeamInvite = (notificationId: any, accept: any) => {
    // Here you would make an API call to accept or deny the team invite
    console.log(
      `Team invite ${
        accept ? "accepted" : "denied"
      } for notification ${notificationId}`
    );
    // Remove the notification after action
    setNotifications(notifications.filter((n: any) => n.id !== notificationId));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative" size="icon">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium">Notifications</h4>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotifications([])}
            >
              Clear all
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No new notifications
            </p>
          ) : (
            notifications.map((notification: any, index: any) => (
              <div key={notification.id}>
                {index > 0 && <Separator className="my-2" />}
                <div className="py-2 px-1">
                  <button
                    className="w-full text-left hover:bg-accent rounded-md transition-colors p-2"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <p className="text-sm font-medium">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.timestamp).toLocaleString()}
                    </p>
                  </button>
                  {notification.type === "team_invite" && (
                    <div className="flex justify-end space-x-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTeamInvite(notification.id, false)}
                      >
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleTeamInvite(notification.id, true)}
                      >
                        Accept
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
