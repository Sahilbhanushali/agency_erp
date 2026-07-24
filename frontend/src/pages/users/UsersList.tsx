import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import UsersListTable from '@/components/tables/UsersListTable';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { User, UserStatus } from "@/types/user";
import { LayoutGrid, List, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { toast } from "react-toastify";
import UsersGridView from "./components/UsersGridView";

const STATUS_OPTIONS: (UserStatus | "ALL")[] = ["ALL", "ACTIVE", "INACTIVE", "SUSPENDED", "INVITED"];

const UsersList = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<UserStatus | "ALL">("ALL");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchUsers = () => {
        setIsLoading(true);
        api
            .get<User[]>("/users")
            .then(setUsers)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load users."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchUsers, []);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return users.filter((user) => {
            const matchesStatus = status === "ALL" || user.status === status;
            const matchesSearch =
                !query ||
                `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [users, search, status]);

    useEffect(() => setPage(1), [search, status, pageSize]);

    const paginatedUsers = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredUsers.slice(start, start + pageSize);
    }, [filteredUsers, page, pageSize]);

    const handleDelete = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/users/${userToDelete.id}`);
            toast.success("User deleted.");
            setUsers((current) => current.filter((user) => user.id !== userToDelete.id));
            setUserToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete user.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Users" text="Users List" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <Input
                                placeholder="Search name or email..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="ps-9 h-11 w-[220px] border border-neutral-300 dark:border-slate-500"
                            />
                        </div>

                        <Select value={status} onValueChange={(value) => setStatus(value as UserStatus | "ALL")}>
                            <SelectTrigger className="min-w-[130px] h-11 dark:bg-slate-700 border border-slate-300 dark:border-slate-500">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === "ALL" ? "All Status" : option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center border border-neutral-300 dark:border-slate-500 rounded-lg overflow-hidden">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="List view"
                                aria-pressed={viewMode === "list"}
                                className={cn("rounded-none h-11 w-11", viewMode === "list" && "bg-primary text-white hover:bg-primary hover:text-white")}
                                onClick={() => setViewMode("list")}
                            >
                                <List className="w-5 h-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Grid view"
                                aria-pressed={viewMode === "grid"}
                                className={cn("rounded-none h-11 w-11", viewMode === "grid" && "bg-primary text-white hover:bg-primary hover:text-white")}
                                onClick={() => setViewMode("grid")}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </Button>
                        </div>

                        <Button className="w-auto h-11" asChild>
                            <Link to="/users-list/create">
                                <Plus className="w-5 h-5" />
                                Add New User
                            </Link>
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No users found.</p>
                    ) : (
                        <>
                            {viewMode === "list" ? (
                                <UsersListTable
                                    users={paginatedUsers}
                                    onView={(user) => navigate(`/users-list/${user.id}`)}
                                    onEdit={(user) => navigate(`/users-list/${user.id}/edit`)}
                                    onDelete={setUserToDelete}
                                />
                            ) : (
                                <UsersGridView
                                    users={paginatedUsers}
                                    onView={(user) => navigate(`/users-list/${user.id}`)}
                                    onEdit={(user) => navigate(`/users-list/${user.id}/edit`)}
                                    onDelete={setUserToDelete}
                                />
                            )}

                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                total={filteredUsers.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!userToDelete}
                onOpenChange={(open) => !open && setUserToDelete(null)}
                title="Delete user"
                description={`Are you sure you want to delete ${userToDelete?.firstName} ${userToDelete?.lastName}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default UsersList;
