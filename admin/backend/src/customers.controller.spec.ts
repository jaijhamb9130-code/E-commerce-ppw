import { HttpException } from '@nestjs/common';
import { CustomersController } from './customers.controller';

/**
 * Unit tests for the customer-facing auth/profile endpoints.
 *
 * These cover the logic the customer sign-up / sign-in flow depends on:
 *  - phone normalization (the identity key for every customer row)
 *  - /customers/register persisting a new customer to the DB
 *  - /customers/register rejecting duplicates (so sign-up can't overwrite)
 *  - /customers/sync upserting on profile edits
 *
 * Repositories are mocked, so no MySQL connection is required.
 */
describe('CustomersController', () => {
  // Minimal mock QueryBuilder so findCustomerByPhone() works without a DB.
  function makeRepo(existing: any = null) {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existing),
    };
    return {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      // save echoes back the entity with a generated id, like TypeORM does
      save: jest.fn().mockImplementation((c: any) => Promise.resolve({ ...c, id: 1 })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;
  }

  function makeController(customerRepo: any, addressRepo: any = makeRepo()) {
    return new CustomersController(customerRepo, addressRepo);
  }

  describe('normalizePhone', () => {
    it('keeps a clean 10-digit number', () => {
      expect(CustomersController.normalizePhone('9876543210')).toBe('9876543210');
    });

    it('strips country code and formatting, keeping the last 10 digits', () => {
      expect(CustomersController.normalizePhone('+91 98765 43210')).toBe('9876543210');
      expect(CustomersController.normalizePhone('098765-43210')).toBe('9876543210');
      expect(CustomersController.normalizePhone(919876543210)).toBe('9876543210');
    });

    it('returns null for short or empty input', () => {
      expect(CustomersController.normalizePhone('12345')).toBeNull();
      expect(CustomersController.normalizePhone('')).toBeNull();
      expect(CustomersController.normalizePhone(null)).toBeNull();
      expect(CustomersController.normalizePhone(undefined)).toBeNull();
    });
  });

  describe('registerCustomer', () => {
    it('persists a new customer with normalized phone', async () => {
      const repo = makeRepo(null); // no existing customer
      const controller = makeController(repo);

      const result = await controller.registerCustomer({
        name: '  Ravi Kumar ',
        phone: '+91 98765 43210',
        shopName: ' Ravi Traders ',
        email: ' ravi@example.com ',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.phone_number).toBe('9876543210'); // normalized
      expect(saved.name).toBe('Ravi Kumar'); // trimmed
      expect(saved.shop_no).toBe('Ravi Traders');
      expect(saved.email).toBe('ravi@example.com');
      expect(result.id).toBe(1);
    });

    it('rejects a phone that is already registered with HTTP 409', async () => {
      const repo = makeRepo({ id: 7, phone_number: '9876543210' });
      const controller = makeController(repo);

      await expect(
        controller.registerCustomer({ name: 'X', phone: '9876543210', shopName: 'Y' }),
      ).rejects.toMatchObject({ status: 409 });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid phone with HTTP 400', async () => {
      const controller = makeController(makeRepo(null));
      await expect(
        controller.registerCustomer({ name: 'X', phone: '123', shopName: 'Y' }),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('requires name and shopName', async () => {
      const controller = makeController(makeRepo(null));
      await expect(
        controller.registerCustomer({ name: '', phone: '9876543210', shopName: 'Y' }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        controller.registerCustomer({ name: 'X', phone: '9876543210', shopName: '' }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('syncCustomer', () => {
    it('creates a customer when the phone is new', async () => {
      const repo = makeRepo(null);
      const controller = makeController(repo);

      await controller.syncCustomer({ name: 'New', phone: '9876543210', shopName: 'Shop' });

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save.mock.calls[0][0].phone_number).toBe('9876543210');
    });

    it('updates fields on an existing customer without rewriting the phone', async () => {
      const existing = { id: 3, phone_number: '919876543210', name: 'Old', shop_no: 'OldShop' };
      const repo = makeRepo(existing);
      const controller = makeController(repo);

      await controller.syncCustomer({ name: 'Updated', phone: '9876543210', shopName: 'NewShop' });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.name).toBe('Updated');
      expect(saved.shop_no).toBe('NewShop');
      expect(saved.phone_number).toBe('919876543210'); // preserved original format
    });
  });
});
