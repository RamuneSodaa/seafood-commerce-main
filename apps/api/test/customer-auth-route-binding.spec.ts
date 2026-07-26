import 'reflect-metadata';

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminAuthGuard } from '../src/modules/admin-auth/admin-auth.guard';
import { AdminRoleGuard } from '../src/modules/admin-auth/admin-role.guard';
import { AuthExchangeController } from '../src/modules/auth-exchange/auth-exchange.controller';
import { CustomerAuthArtifactGuard } from '../src/modules/auth-exchange/customer-auth-artifact.guard';
import { CartController } from '../src/modules/cart/cart.controller';
import { CouponsController } from '../src/modules/coupons/coupons.controller';
import { CustomerAddressesController } from '../src/modules/customer-addresses/customer-addresses.controller';
import { MembersController } from '../src/modules/members/members.controller';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { ReferralsController } from '../src/modules/referrals/referrals.controller';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

type ControllerClass = { prototype: any };

function guardsOn(target: unknown): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, target as object) || [];
}

function classGuards(controller: ControllerClass): unknown[] {
  return guardsOn(controller);
}

function methodGuards(
  controller: ControllerClass,
  methodName: string
): unknown[] {
  const method = controller.prototype[methodName];

  if (typeof method !== 'function') {
    throw new Error(`Missing controller method ${methodName}`);
  }

  return guardsOn(method);
}

function expectCustomerGuard(
  controller: ControllerClass,
  methodName?: string
) {
  const guards = methodName
    ? methodGuards(controller, methodName)
    : classGuards(controller);

  expect(guards).toContain(CustomerAuthArtifactGuard);
  expect(guards).not.toContain(AdminAuthGuard);
}

function expectAdminGuard(
  controller: ControllerClass,
  methodName: string
) {
  const guards = methodGuards(controller, methodName);

  expect(guards).toContain(AdminAuthGuard);
  expect(guards).toContain(AdminRoleGuard);
  expect(guards).not.toContain(CustomerAuthArtifactGuard);
}

function walkTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return walkTypeScriptFiles(path);
    }

    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('Customer authentication route binding', () => {
  test('customer-owned controller groups are protected at class level', () => {
    expectCustomerGuard(CartController);
    expectCustomerGuard(CouponsController);
    expectCustomerGuard(MembersController);
    expectCustomerGuard(ReferralsController);
  });

  test('all customer address aliases use the signed customer artifact guard', () => {
    for (const methodName of [
      'list',
      'listAuthenticated',
      'create',
      'createAuthenticated',
      'setDefault',
      'setDefaultAuthenticated'
    ]) {
      expectCustomerGuard(
        CustomerAddressesController,
        methodName
      );
    }
  });

  test('all customer order seams use the signed customer artifact guard', () => {
    for (const methodName of [
      'createOrder',
      'createAuthenticatedOrder',
      'createFreshPreorder',
      'createFreshPreorderAuthenticated',
      'previewOrderQuote',
      'previewAuthenticatedOrderQuote',
      'listAuthenticatedOrders',
      'getAuthenticatedOrder',
      'previewAuthenticatedReorder',
      'createMiniappPayment',
      'cancelAuthenticatedOrder'
    ]) {
      expectCustomerGuard(OrdersController, methodName);
    }
  });

  test('admin order mutations remain admin-only', () => {
    for (const methodName of [
      'listOrders',
      'getOrder',
      'markPaid',
      'cancel',
      'readyForPickup',
      'completePickup',
      'ship',
      'deliver',
      'confirmFreshPreorder',
      'completeFreshPreorder',
      'cancelFreshPreorder'
    ]) {
      expectAdminGuard(OrdersController, methodName);
    }
  });

  test('payment callback remains outside customer/admin guards for signature verification', () => {
    const guards = methodGuards(
      OrdersController,
      'handleMiniappPaymentCallback'
    );

    expect(guards).not.toContain(CustomerAuthArtifactGuard);
    expect(guards).not.toContain(AdminAuthGuard);
  });

  test('only customer artifact verification route is guarded in auth exchange controller', () => {
    expect(methodGuards(
      AuthExchangeController,
      'exchangePlaceholder'
    )).toHaveLength(0);
    expect(methodGuards(
      AuthExchangeController,
      'exchangeReal'
    )).toHaveLength(0);
    expectCustomerGuard(
      AuthExchangeController,
      'verifyCustomerArtifact'
    );
  });

  test('runtime API source no longer reads legacy identity headers', () => {
    const sourceRoot = resolve(__dirname, '../src');
    const hits = walkTypeScriptFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /x-role|x-user-id/i.test(source) ? [path] : [];
    });

    expect(hits).toEqual([]);
  });

  test('CORS allows Authorization but not legacy identity headers', () => {
    const mainSource = readFileSync(
      resolve(__dirname, '../src/main.ts'),
      'utf8'
    );

    expect(mainSource).toContain("'Authorization'");
    expect(mainSource).not.toMatch(/x-role|x-user-id/i);
  });
});
