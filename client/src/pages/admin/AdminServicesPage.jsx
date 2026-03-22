import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Pencil, Trash2, X, Search } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, Input, Textarea } from '../../components/common';
import { Button, AsyncState, ConfirmDialog, PageHeader } from '../../components/common';
import { createService, getAllServices, updateService, deleteService } from '../../api/services';
import { getPageLayout } from '../../constants/layout';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminServicesPage() {
    usePageTitle('Manage Services');
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    name: '',
    category: '',
    basePrice: '',
    description: '',
  });
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, service: null });

  const servicesQuery = useQuery({
    queryKey: queryKeys.services.all(),
    queryFn: getAllServices,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => createService(payload),
    onSuccess: () => {
      toast.success('Service created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all() });
      resetForm();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create service'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateService(id, payload),
    onSuccess: () => {
      toast.success('Service updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all() });
      resetForm();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update service'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteService(id),
    onSuccess: () => {
      toast.success('Service deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all() });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete service'),
  });

  const services = servicesQuery.data?.services || servicesQuery.data || [];

  const normalizedSearch = searchTerm.toLowerCase();
  const filteredServices = services.filter((service) => {
    const serviceName = String(service.name || '').toLowerCase();
    const serviceCategory = String(service.category || '').toLowerCase();
    return serviceName.includes(normalizedSearch) || serviceCategory.includes(normalizedSearch);
  });


  const resetForm = () => {
    setFormState({ name: '', category: '', basePrice: '', description: '' });
    setEditId(null);
  };

  const handleChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (service) => {
    setFormState({
      name: service.name,
      category: service.category || '',
      basePrice: service.basePrice || '',
      description: service.description || '',
    });
    setEditId(service.id);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      name: formState.name,
      category: formState.category || undefined,
      description: formState.description || undefined,
      basePrice: formState.basePrice ? Number(formState.basePrice) : undefined,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <PageHeader
          title="Services Catalog"
          subtitle="Manage the services available for customers."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{editId ? 'Edit Service' : 'Add Service'}</CardTitle>
              <CardDescription>
                {editId ? 'Update details for this service' : 'Create a new service for the marketplace.'}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
              <Input
                label="Service Name"
                value={formState.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="e.g., Home Cleaning"
                required
              />

              <Input
                label="Category"
                value={formState.category}
                onChange={(event) => handleChange('category', event.target.value)}
                placeholder="e.g., Home"
              />

              <Input
                label="Base Price (₹)"
                type="number"
                value={formState.basePrice}
                onChange={(event) => handleChange('basePrice', event.target.value)}
                placeholder="e.g., 500"
              />

              <Textarea
                label="Description"
                rows={4}
                value={formState.description}
                onChange={(event) => handleChange('description', event.target.value)}
                placeholder="Describe the service"
              />

              {(createMutation.isError || updateMutation.isError) && (
                <p className="text-sm text-error-500">
                  {createMutation.error?.response?.data?.error || updateMutation.error?.response?.data?.error || 'Operation failed.'}
                </p>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  fullWidth
                  icon={editId ? Pencil : PlusCircle}
                  loading={isPending}
                >
                  {editId ? 'Update Service' : 'Add Service'}
                </Button>

                {editId && (
                  <Button
                    type="button"
                    fullWidth
                    variant="outline"
                    icon={X}
                    onClick={resetForm}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Services</CardTitle>
              <CardDescription>Visible services for customers.</CardDescription>
            </CardHeader>

            <div className="px-6 pt-2 pb-4">
              <Input
                icon={Search}
                placeholder="Search by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <AsyncState
              isLoading={servicesQuery.isLoading}
              isError={servicesQuery.isError}
              error={servicesQuery.error}
              isEmpty={!servicesQuery.isLoading && !servicesQuery.isError && services.length === 0}
              emptyTitle="No services added"
              emptyMessage="Create a service to get started."
              errorFallback={
                <div className="px-6 pb-6">
                  <p className="text-error-500">Failed to load services.</p>
                </div>
              }
            >
              <div className="space-y-3 px-6 pb-6 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
                {filteredServices.map((service) => (
                  <div key={service.id} className="rounded-lg border px-4 py-3 flex items-start justify-between group transition-all border-gray-100 bg-gray-50 hover:border-gray-200 dark:border-dark-700 dark:bg-dark-800 dark:hover:border-dark-600">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {service.name}
                        </p>
                        {service.id === editId && (
                          <span className="text-xs bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">Editing</span>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        {service.category || 'Uncategorized'} · {service.basePrice ? `INR ${service.basePrice}` : 'No base price'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => handleEdit(service)}
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      >
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        loading={deleteMutation.isPending && deleteMutation.variables === service.id}
                        onClick={() => setDeleteDialog({ isOpen: true, service })}
                        className="text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
                        aria-label="Delete service"
                      >
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </AsyncState>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          onConfirm={() => {
            deleteMutation.mutate(deleteDialog.service.id);
            setDeleteDialog({ isOpen: false, service: null });
          }}
          onCancel={() => setDeleteDialog({ isOpen: false, service: null })}
          title="Delete Service"
          message={`Are you sure you want to delete "${deleteDialog.service?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          loading={deleteMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
