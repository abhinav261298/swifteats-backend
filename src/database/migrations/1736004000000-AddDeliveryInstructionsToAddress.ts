import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDeliveryInstructionsToAddress1736004000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'addresses',
      new TableColumn({
        name: 'deliveryInstructions',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('addresses', 'deliveryInstructions');
  }
}
