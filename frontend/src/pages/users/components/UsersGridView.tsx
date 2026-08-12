import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/types/user";
import { ChevronRight, EllipsisVertical } from "lucide-react";

interface UsersGridViewProps {
    users: User[];
    onView: (user: User) => void;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
}

const UsersGridView = ({ users, onView, onEdit, onDelete }: UsersGridViewProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-6 items-start">
            {users.map((user) => (
                <div key={user.id} className="border border-neutral-200 dark:border-neutral-600 rounded-2xl overflow-hidden">
                    <div className="relative h-[80px] bg-gradient-to-r from-primary/40 to-primary/10">
                        <div className="absolute top-0 end-0 me-3 mt-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger className="bg-white/30 w-8 h-8 rounded-lg border border-white/40 flex justify-center items-center text-white">
                                    <EllipsisVertical className="h-5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => onEdit(user)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDelete(user)} className="text-red-600 focus:text-red-600">
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="px-6 pb-4 text-center -mt-[40px] relative z-[1]">
                        <span className="flex items-center justify-center w-20 h-20 mx-auto rounded-full bg-primary text-white text-2xl font-semibold border-4 border-card">
                            {user.firstName[0]?.toUpperCase()}
                        </span>
                        <h6 className="text-lg mb-0 mt-2">{user.firstName} {user.lastName}</h6>
                        <span className="text-neutral-500 dark:text-neutral-300 mb-4 block">{user.email}</span>

                        <div className="relative bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 flex items-center gap-4 before:absolute before:w-px before:h-full before:z-[1] before:bg-neutral-200 dark:before:bg-neutral-500 before:start-1/2">
                            <div className="text-center w-1/2">
                                <h6 className="text-base mb-0 truncate">{user.department || "—"}</h6>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm mb-0">Department</span>
                            </div>
                            <div className="text-center w-1/2">
                                <h6 className="text-base mb-0 truncate">{user.designation || "—"}</h6>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm mb-0">Designation</span>
                            </div>
                        </div>

                        <Button
                            className="bg-blue-50 hover:bg-primary dark:hover:bg-primary hover:text-white dark:hover:text-white dark:bg-primary/25 text-primary dark:text-blue-400 text-sm px-3 py-3 rounded-lg flex items-center justify-center mt-4 font-medium gap-2 w-full h-12"
                            onClick={() => onView(user)}
                        >
                            View Profile
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UsersGridView;
